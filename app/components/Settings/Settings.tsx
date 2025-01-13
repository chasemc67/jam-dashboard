import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
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
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="left-handed"
                checked={settings.isLefty}
                onCheckedChange={checked =>
                  updateSettings({ isLefty: checked === true })
                }
              />
              <Label htmlFor="left-handed">Left-handed</Label>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
