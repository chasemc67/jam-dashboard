const colorGroups = {
  'Base Colors': ['background', 'foreground'],
  'Component Colors': [
    'card',
    'popover',
    'primary',
    'secondary',
    'muted',
    'accent',
  ],
  'State Colors': ['destructive'],
  'Border & Input': ['border', 'input', 'ring'],
  'Chart Colors': ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'],
};

function ColorSwatch({ name }: { name: string }) {
  const baseClass = name.startsWith('chart-')
    ? `bg-chart-${name.split('-')[1]}`
    : `bg-${name}`;
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 w-16 rounded-md ${baseClass} ring-1 ring-border`} />
      <span className="text-sm text-muted-foreground">{name}</span>
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
