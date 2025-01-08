const colorGroups = {
  'Base Colors': ['bg-background', 'bg-foreground'],
  'Component Colors': [
    'bg-card',
    'bg-popover',
    'bg-primary',
    'bg-secondary',
    'bg-muted',
    'bg-accent',
  ],
  'State Colors': ['bg-destructive'],
  'Border & Input': ['bg-border', 'bg-input', 'bg-ring'],
  'Chart Colors': [
    'bg-chart-0',
    'bg-chart-1',
    'bg-chart-2',
    'bg-chart-3',
    'bg-chart-4',
    'bg-chart-5',
    'bg-chart-6',
    'bg-chart-7',
  ],
};

function ColorSwatch({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 w-16 rounded-md ${name} ring-1 ring-border`} />
      <span className="text-sm text-muted-foreground">
        {name.replace('bg-', '')}
      </span>
    </div>
  );
}

export default function Theme() {
  return (
    <div className="min-h-screen bg-background dark p-8">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-foreground">Color Palette</h2>
          {Object.entries(colorGroups).map(([groupName, colors]) => (
            <div key={groupName} className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">
                {groupName}
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {colors.map(color => (
                  <ColorSwatch key={color} name={color} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Text Colors</h2>
          <div className="space-y-2">
            <p className="rounded bg-primary p-2 text-primary-foreground">
              Primary Foreground
            </p>
            <p className="rounded bg-secondary p-2 text-secondary-foreground">
              Secondary Foreground
            </p>
            <p className="rounded bg-card p-2 text-card-foreground">
              Card Foreground
            </p>
            <p className="rounded bg-popover p-2 text-popover-foreground">
              Popover Foreground
            </p>
            <p className="text-muted-foreground">Muted Foreground</p>
            <p className="rounded bg-accent p-2 text-accent-foreground">
              Accent Foreground
            </p>
            <p className="rounded bg-destructive p-2 text-destructive-foreground">
              Destructive Foreground
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
