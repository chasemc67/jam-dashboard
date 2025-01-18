import React from 'react';
import { Card } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import RandomPlayer from '~/components/RandomPlayer';
import ChordExplorer from '~/components/ChordExplorer';

const TabChordView: React.FC = () => {
  return (
    <Card className="w-full max-w-[750px]">
      <Tabs defaultValue="ear-training" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="ear-training" className="flex-1">
            Ear Training
          </TabsTrigger>
          <TabsTrigger value="chord-explorer" className="flex-1">
            Chord Explorer
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ear-training">
          <RandomPlayer />
        </TabsContent>
        <TabsContent value="chord-explorer">
          <ChordExplorer />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default TabChordView;
