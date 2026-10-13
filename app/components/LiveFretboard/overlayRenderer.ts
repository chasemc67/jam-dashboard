import type { HandMask } from '~/types/fretTracker';
// WebGL2 renderer for the live fretboard: draws the video frame, then the
// projected note patches, wires, strings and labels on top, in source pixels.
import type { OverlayGeometry } from './overlayGeometry';
import type { Point } from '~/utils/fretProjection';

export type RGBA = [number, number, number, number];

const VIDEO_VS = `#version 300 es
in vec2 a_pos;
uniform float u_flip;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  if (u_flip > 0.5) v_uv.x = 1.0 - v_uv.x;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;
const VIDEO_FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 color;
void main() { color = texture(u_tex, v_uv); }`;

// Positions are source pixels with pixel centers on integers (as the tracker reports them).
const SHAPE_VS = `#version 300 es
in vec2 a_pos;
in vec4 a_color;
in vec2 a_uv;
uniform vec2 u_size;
out vec4 v_color;
out vec2 v_uv;
out vec2 v_screen;
void main() {
  v_screen = (a_pos + 0.5) / u_size;
  vec2 clip = (a_pos + 0.5) / u_size * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_color;
  v_uv = a_uv;
}`;
const SHAPE_FS = `#version 300 es
precision mediump float;
in vec4 v_color;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform float u_text;
in vec2 v_screen;
uniform sampler2D u_hand;
uniform vec4 u_handTransform;
uniform float u_hasHand;
out vec4 color;
void main() {
  float alpha = u_text > 0.5 ? texture(u_atlas, v_uv).a : 1.0;
  float handAlpha = u_hasHand > 0.5 ? texture(u_hand, v_screen * u_handTransform.xy + u_handTransform.zw).r : 0.0;
  color = vec4(v_color.rgb, v_color.a * alpha * (1.0 - handAlpha));
}`;

const ATLAS_CELL = 64;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL program could not be created.');
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader could not be created.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader error.');
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'Program link error.');
  return program;
}

/** Note color names ("red", ...) -> RGBA from the theme's --note-* variables. */
export function resolveNoteColor(name: string): RGBA {
  const fallback: RGBA = [0.6, 0.6, 0.6, 1];
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--note-${name}`)
    .trim();
  if (!value) return fallback;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return fallback;
  context.fillStyle = `hsl(${value})`;
  const hex = context.fillStyle; // normalized to #rrggbb
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return fallback;
  return [
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
    1,
  ];
}

export class OverlayRenderer {
  private gl: WebGL2RenderingContext;
  private videoProgram: WebGLProgram;
  private shapeProgram: WebGLProgram;
  private videoTexture: WebGLTexture;
  private handTexture: WebGLTexture;
  private lastHand: HandMask | null = null;
  private atlasTexture: WebGLTexture;
  private quadBuffer: WebGLBuffer;
  private shapeBuffer: WebGLBuffer;
  private videoVao: WebGLVertexArrayObject;
  private shapeVao: WebGLVertexArrayObject;
  private atlasKey = '';
  private atlasIndex = new Map<string, number>();
  private colors = new Map<string, RGBA>();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 is not available.');
    this.gl = gl;
    this.videoProgram = compile(gl, VIDEO_VS, VIDEO_FS);
    this.shapeProgram = compile(gl, SHAPE_VS, SHAPE_FS);
    const texture = () => {
      const t = gl.createTexture();
      if (!t) throw new Error('WebGL texture could not be created.');
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.handTexture = texture();
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      1,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0]),
    );
    this.videoTexture = texture();
    this.atlasTexture = texture();
    const buffer = () => {
      const b = gl.createBuffer();
      if (!b) throw new Error('WebGL buffer could not be created.');
      return b;
    };
    this.quadBuffer = buffer();
    this.shapeBuffer = buffer();

    const videoVao = gl.createVertexArray();
    const shapeVao = gl.createVertexArray();
    if (!videoVao || !shapeVao) throw new Error('WebGL VAO unavailable.');
    this.videoVao = videoVao;
    this.shapeVao = shapeVao;
    gl.bindVertexArray(videoVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const videoPos = gl.getAttribLocation(this.videoProgram, 'a_pos');
    gl.enableVertexAttribArray(videoPos);
    gl.vertexAttribPointer(videoPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffer);
    const stride = 8 * 4; // pos(2) color(4) uv(2)
    for (const [name, size, offset] of [
      ['a_pos', 2, 0],
      ['a_color', 4, 8],
      ['a_uv', 2, 24],
    ] as const) {
      const location = gl.getAttribLocation(this.shapeProgram, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    }
    gl.bindVertexArray(null);
  }

  private color(name: string): RGBA {
    let rgba = this.colors.get(name);
    if (!rgba) {
      rgba = resolveNoteColor(name);
      this.colors.set(name, rgba);
    }
    return rgba;
  }

  /** Forget cached theme colors (after a theme change). */
  resetColors() {
    this.colors.clear();
  }

  private updateAtlas(labels: string[]) {
    const unique = [...new Set(labels)].sort();
    const key = unique.join('\u0000');
    if (key === this.atlasKey) return;
    this.atlasKey = key;
    this.atlasIndex = new Map(unique.map((label, i) => [label, i]));
    const columns = 8;
    const rows = Math.max(1, Math.ceil(unique.length / columns));
    const canvas = document.createElement('canvas');
    canvas.width = columns * ATLAS_CELL;
    canvas.height = rows * ATLAS_CELL;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    unique.forEach((label, i) => {
      const size = label.length > 2 ? 26 : 38;
      context.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
      context.fillText(
        label,
        (i % columns) * ATLAS_CELL + ATLAS_CELL / 2,
        Math.floor(i / columns) * ATLAS_CELL + ATLAS_CELL / 2 + 2,
        ATLAS_CELL - 4,
      );
    });
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  render(
    video: TexImageSource,
    width: number,
    height: number,
    mirrored: boolean,
    overlay: OverlayGeometry,
    handMask: HandMask | null = null,
    handTransform: [number, number, number, number] = [1, 1, 0, 0],
  ) {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.videoProgram);
    gl.bindVertexArray(this.videoVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(gl.getUniformLocation(this.videoProgram, 'u_tex'), 0);
    gl.uniform1f(
      gl.getUniformLocation(this.videoProgram, 'u_flip'),
      mirrored ? 1 : 0,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const shapes: number[] = [];
    const push = (p: Point, c: RGBA, uv: Point = [0, 0]) =>
      shapes.push(p[0], p[1], c[0], c[1], c[2], c[3], uv[0], uv[1]);
    const line = ([a, b]: [Point, Point], thickness: number, c: RGBA) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(length > 0)) return;
      const nx = (-(b[1] - a[1]) / length) * (thickness / 2);
      const ny = ((b[0] - a[0]) / length) * (thickness / 2);
      const p0: Point = [a[0] + nx, a[1] + ny];
      const p1: Point = [b[0] + nx, b[1] + ny];
      const p2: Point = [b[0] - nx, b[1] - ny];
      const p3: Point = [a[0] - nx, a[1] - ny];
      [p0, p1, p2, p0, p2, p3].forEach(p => push(p, c));
    };
    const scale = Math.max(1, width / 1280);
    overlay.strings.forEach(s => line(s, 1.5 * scale, [1, 1, 1, 0.35]));
    overlay.wires.forEach((w, i) =>
      line(w, (i === 0 ? 4 : 2) * scale, [0.95, 0.95, 0.85, 0.6]),
    );
    for (const cell of overlay.cells) {
      const [r, g, b] = this.color(cell.color);
      const c: RGBA = [r, g, b, 0.82];
      const [q0, q1, q2, q3] = cell.quad;
      [q0, q1, q2, q0, q2, q3].forEach(p => push(p, c));
    }
    const shapeCount = shapes.length / 8;

    this.updateAtlas(overlay.labels.map(label => label.text));
    const columns = 8;
    const atlasRows = Math.max(1, Math.ceil(this.atlasIndex.size / columns));
    const textColor: RGBA = [0.06, 0.06, 0.08, 1];
    for (const label of overlay.labels) {
      const index = this.atlasIndex.get(label.text);
      if (index === undefined) continue;
      const u0 = (index % columns) / columns;
      const v0 = Math.floor(index / columns) / atlasRows;
      const u1 = u0 + 1 / columns;
      const v1 = v0 + 1 / atlasRows;
      const h = label.size / 2;
      const [x, y] = label.center;
      const corners: [Point, Point][] = [
        [
          [x - h, y - h],
          [u0, v0],
        ],
        [
          [x + h, y - h],
          [u1, v0],
        ],
        [
          [x + h, y + h],
          [u1, v1],
        ],
        [
          [x - h, y + h],
          [u0, v1],
        ],
      ];
      [0, 1, 2, 0, 2, 3].forEach(i =>
        push(corners[i][0], textColor, corners[i][1]),
      );
    }
    if (!shapes.length) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.shapeProgram);
    gl.bindVertexArray(this.shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapes), gl.STREAM_DRAW);
    gl.uniform2f(
      gl.getUniformLocation(this.shapeProgram, 'u_size'),
      width,
      height,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(gl.getUniformLocation(this.shapeProgram, 'u_atlas'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.handTexture);
    if (handMask && handMask !== this.lastHand) {
      const bytes = Uint8Array.from(atob(handMask.alpha), c => c.charCodeAt(0));
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        handMask.width,
        handMask.height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        bytes,
      );
      this.lastHand = handMask;
    }
    gl.uniform1i(gl.getUniformLocation(this.shapeProgram, 'u_hand'), 1);
    gl.uniform1f(
      gl.getUniformLocation(this.shapeProgram, 'u_hasHand'),
      handMask ? 1 : 0,
    );
    gl.uniform4fv(
      gl.getUniformLocation(this.shapeProgram, 'u_handTransform'),
      handTransform,
    );
    gl.activeTexture(gl.TEXTURE0);
    const textFlag = gl.getUniformLocation(this.shapeProgram, 'u_text');
    gl.uniform1f(textFlag, 0);
    gl.drawArrays(gl.TRIANGLES, 0, shapeCount);
    const textCount = shapes.length / 8 - shapeCount;
    if (textCount > 0) {
      gl.uniform1f(textFlag, 1);
      gl.drawArrays(gl.TRIANGLES, shapeCount, textCount);
    }
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.handTexture);
    gl.deleteTexture(this.videoTexture);
    gl.deleteTexture(this.atlasTexture);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteBuffer(this.shapeBuffer);
    gl.deleteVertexArray(this.videoVao);
    gl.deleteVertexArray(this.shapeVao);
    gl.deleteProgram(this.videoProgram);
    gl.deleteProgram(this.shapeProgram);
  }
}
