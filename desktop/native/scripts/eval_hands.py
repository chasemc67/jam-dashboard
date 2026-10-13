#!/usr/bin/env python3
"""Mini-only quality/latency evaluation. Dependencies: mediapipe, torch, opencv, numpy.
Run from an isolated checkout with eval-models/{EfficientSAM,hand_landmarker.task,selfie_multiclass_256x256.tflite}.
No training. All timings include prompts/ROI work, exclude video IO and model load.
"""
import argparse, base64, json, os, subprocess, struct, sys, time
from pathlib import Path
import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--video', required=True)
parser.add_argument('--start', type=float, default=30)
parser.add_argument('--seconds', type=float, default=15)
parser.add_argument('--fps', type=int, default=15)
parser.add_argument('--flip', action='store_true')
parser.add_argument('--native-only', action='store_true', help='Protocol/orientation smoke check only')
parser.add_argument('--out', required=True)
parser.add_argument('--model', required=True)
a = parser.parse_args()
root = Path.cwd(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
size = 832
cap = cv2.VideoCapture(a.video)
w,h = int(cap.get(3)),int(cap.get(4)); fps = cap.get(5)
nw,nh = round(w*min(size/w,size/h)),round(h*min(size/w,size/h))
left,top = round((size-nw)/2-0.1),round((size-nh)/2-0.1)
frames=[]; inputs=[]
for i in range(round(a.seconds*a.fps)):
    cap.set(cv2.CAP_PROP_POS_MSEC, (a.start+i/a.fps)*1000)
    ok, frame = cap.read()
    if not ok: break
    frames.append(cv2.resize(frame,(640,360)))
    rgb=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)
    if a.flip: rgb=rgb[:,::-1]
    inp=np.full((size,size,3),114,np.uint8)
    inp[top:top+nh,left:left+nw]=cv2.resize(rgb,(nw,nh))
    inputs.append(inp)
cap.release()
N=len(inputs); timings={}; masks={}; records={}
for option,flag in [('off',0),('vision-fast',1),('vision-balanced',2),('skin',3)]:
    print('native', option, N, flush=True)
    proc=subprocess.Popen([str(root/'desktop/native/.build/release/FretTrackerCLI'),'--model',a.model,'--compute-units','cpuAndNeuralEngine'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    assert json.loads(proc.stdout.readline())['type']=='ready'
    rows=[]; times=[]; mm=[]
    for i,inp in enumerate(inputs):
        rgba=cv2.cvtColor(inp,cv2.COLOR_RGB2RGBA).tobytes()
        header=struct.pack('<4sIdIIII',b'FRT1',i,a.start+i/a.fps,w,h,int(a.flip)|(2 if i==0 else 0)|(flag<<2),len(rgba))
        proc.stdin.write(header+rgba);proc.stdin.flush()
        row=json.loads(proc.stdout.readline())
        if row.get('handError'): raise RuntimeError(row['handError'])
        rows.append(row);times.append(row.get('handMs',0))
        mask=row.get('handMask')
        mm.append(np.frombuffer(base64.b64decode(mask['alpha']),np.uint8).reshape(mask['height'],mask['width']) if mask else np.zeros((208,208),np.uint8))
    proc.stdin.close();proc.wait()
    timings[option]=times;masks[option]=mm;records[option]=rows
    (out/(option+'.json')).write_text(json.dumps(rows))

if a.native_only: sys.exit(0)

# MediaPipe CPU tasks; no native macOS Swift task distribution. Image mode is reproducible.
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
hand=vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(root/'eval-models/hand_landmarker.task')),num_hands=2))
seg=vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=python.BaseOptions(model_asset_path=str(root/'eval-models/selfie_multiclass_256x256.tflite')),output_confidence_masks=True))
mm=[];times=[]
for i,inp in enumerate(inputs):
    t=time.perf_counter();image=mp.Image(image_format=mp.ImageFormat.SRGB,data=inp)
    landmarks=hand.detect(image).hand_landmarks
    roi=np.zeros((size,size),np.float32)
    for points in landmarks:
        xy=np.array([(p.x,p.y) for p in points]); lo=xy.min(0);hi=xy.max(0)
        pad=max(0.015,float(max(hi-lo))*0.18)
        lo=np.clip(((lo-pad)*size).astype(int),0,size);hi=np.clip(((hi+pad)*size).astype(int),0,size)
        roi[lo[1]:hi[1],lo[0]:hi[0]]=1
    mask=seg.segment(image).confidence_masks[2].numpy_view().copy().squeeze()*roi if landmarks else roi
    mm.append(cv2.resize(np.uint8(mask*255),(208,208)))
    times.append((time.perf_counter()-t)*1000)
    if i%50==0: print('mediapipe',i,flush=True)
hand.close();seg.close();masks['mediapipe']=mm;timings['mediapipe']=times

import torch
sys.path.insert(0,str(root/'eval-models/EfficientSAM'))
from efficient_sam.build_efficient_sam import build_efficient_sam_vitt
os.chdir(root/'eval-models/EfficientSAM')
device='mps' if torch.backends.mps.is_available() else 'cpu'
model=build_efficient_sam_vitt().to(device)
os.chdir(root)
torch.set_num_threads(4)
mm=[];times=[]
for i,inp in enumerate(inputs):
    boxes=records['vision-fast'][i].get('handBoxes',[])
    t=time.perf_counter(); mask=np.zeros((size,size),np.uint8)
    if boxes:
        pts=np.array([[[b[0]*size,b[1]*size],[b[2]*size,b[3]*size]] for b in boxes],np.float32)
        with torch.inference_mode():
            logits,ious=model(torch.from_numpy(inp.copy()).permute(2,0,1)[None].to(device).float()/255,
                              torch.from_numpy(pts)[None].to(device),torch.tensor([[[2,3]]*len(boxes)],device=device))
            for j in range(len(boxes)):
                best=int(ious[0,j].argmax().item())
                mask=np.maximum(mask,(logits[0,j,best].ge(0).cpu().numpy()*255).astype(np.uint8))
    mm.append(cv2.resize(mask,(208,208)))
    # Include the measured Vision pose cost from skin mode (also includes tiny color ROI cost).
    times.append((time.perf_counter()-t)*1000+timings['skin'][i])
    if i%25==0: print('efficientsam',device,i,times[-1],flush=True)
masks['efficientsam']=mm;timings['efficientsam']=times
np.savez_compressed(out/'masks.npz',**{k:np.array(v) for k,v in masks.items()})
summary={'video':a.video,'start':a.start,'seconds':N/a.fps,'fps':a.fps,'source':[w,h],'input':[size,size],'mask':[208,208],'flip':a.flip,'samDevice':device,'options':{}}
for k,v in timings.items():
    warm=v[5:]
    summary['options'][k]={'medianMs':float(np.median(warm)),'p95Ms':float(np.percentile(warm,95)),'frames':len(warm),'nonemptyFrames':int(sum(np.any(x) for x in masks[k]))}
(out/'latency.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)

def overlay(row):
    layer=np.zeros((360,640,4),np.uint8)
    if not row['valid'] or not row['H']: return layer
    H=np.array(row['H']).reshape(3,3);tau=row['tau'];n=row['nFrets']
    def point(u,y):
        q=H@np.array([u,(y-0.5)*(1+tau*u),1]);p=q[:2]/q[2]*[640/w,360/h]
        return tuple(np.clip(p,-10000,10000).astype(int))
    def u(f): return 1-2**(-f/12)
    for s in range(6):cv2.line(layer,point(0,s/5),point(u(n),s/5),(255,255,255,100),1,cv2.LINE_AA)
    for f in range(n+1):cv2.line(layer,point(u(f),0),point(u(f),1),(230,240,240,150),1,cv2.LINE_AA)
    for f in range(1,n+1):
        for s,base in enumerate([4,9,2,7,11,4]):
            note=(base+f)%12
            if note not in [0,2,4,5,7,9,11]:continue
            lo,hi=u(f-1),u(f);d=hi-lo;y=s/5
            poly=np.array([point(lo+d*.1,y-.08),point(hi-d*.1,y-.08),point(hi-d*.1,y+.08),point(lo+d*.1,y+.08)])
            color=(75,95,240,210) if note==0 else (80,205,120,210)
            cv2.fillConvexPoly(layer,poly,color,cv2.LINE_AA)
    return layer
keys=list(masks)
encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1920x720','-r',str(a.fps),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'comparison.mp4')],stdin=subprocess.PIPE)
for i,frame in enumerate(frames):
    layer=overlay(records['off'][i]);tiles=[]
    for k in keys:
        square=cv2.resize(masks[k][i],(size,size),interpolation=cv2.INTER_LINEAR)
        mask=square[top:top+nh,left:left+nw]
        if a.flip:mask=mask[:,::-1]
        mask=cv2.resize(mask,(640,360))/255
        alpha=layer[:,:,3:4]/255*(1-mask[:,:,None])
        tile=np.uint8(frame*(1-alpha)+layer[:,:,:3]*alpha)
        cv2.rectangle(tile,(0,0),(639,43),(18,18,18),-1)
        title=f'{k} | Mini {summary["options"][k]["medianMs"]:.1f} ms median'
        cv2.putText(tile,title,(10,19),cv2.FONT_HERSHEY_SIMPLEX,.48,(255,255,255),1,cv2.LINE_AA)
        cv2.putText(tile,f'v4q832 | t={a.start+i/a.fps:.2f}s | hand p95 {summary["options"][k]["p95Ms"]:.1f} ms',(10,36),cv2.FONT_HERSHEY_SIMPLEX,.38,(190,190,190),1,cv2.LINE_AA)
        tiles.append(tile)
    grid=np.vstack([np.hstack(tiles[:3]),np.hstack(tiles[3:])]);encoder.stdin.write(grid.tobytes())
    if i in [0,N//4,N//2,3*N//4,N-1]:cv2.imwrite(str(out/f'frame-{i:03d}.jpg'),grid)
encoder.stdin.close();assert encoder.wait()==0
