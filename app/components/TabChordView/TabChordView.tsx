import React from 'react';
import { Card } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import RandomPlayer from '~/components/RandomPlayer';
import ChordExplorer from '~/components/ChordExplorer';
import { useHighlight } from '~/contexts/HighlightContext';

const TabChordView: React.FC = () => {
  const { clearChordHighlight } = useHighlight();

  return (
    <Card className="w-full max-w-[750px]">
      <Tabs
        defaultValue="chord-explorer"
        className="w-full"
        onValueChange={() => clearChordHighlight()}
      >
        <TabsList className="w-full">
          <TabsTrigger value="chord-explorer" className="flex-1">
            Chord Explorer
          </TabsTrigger>
          <TabsTrigger value="ear-training" className="flex-1">
            Ear Training
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chord-explorer">
          <ChordExplorer />
        </TabsContent>
        <TabsContent value="ear-training">
          <RandomPlayer />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default TabChordView;
