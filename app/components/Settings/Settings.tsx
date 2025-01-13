import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { useSettings } from '~/contexts/SettingsContext';

export default function Settings() {
  const { settings, updateSettings } = useSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Fretboard Settings</h4>
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="left-handed"
                  checked={settings.isLefty}
                  onCheckedChange={checked =>
                    updateSettings({ isLefty: checked === true })
                  }
                />
                <Label htmlFor="left-handed">Left-handed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-text-notes"
                  checked={settings.showTextNotes}
                  onCheckedChange={checked =>
                    updateSettings({ showTextNotes: checked === true })
                  }
                />
                <Label htmlFor="show-text-notes">Show Text Notes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="number-of-frets">Number of Frets:</Label>
                <Input
                  id="number-of-frets"
                  type="number"
                  min="1"
                  max="24"
                  value={settings.numberOfFrets}
                  onChange={e =>
                    updateSettings({ numberOfFrets: Number(e.target.value) })
                  }
                  className="w-[60px]"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
