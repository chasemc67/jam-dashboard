import { getMcpToolReference } from './reference';
import { agentTools } from './tools';

describe('MCP tool reference', () => {
  it('lists the registered tools as serializable definitions without execution handlers', () => {
    const reference = getMcpToolReference();

    expect(reference.map(tool => tool.name)).toEqual(
      agentTools.map(tool => tool.name),
    );
    expect(JSON.parse(JSON.stringify(reference))).toEqual(reference);
    for (const tool of reference) {
      expect(Object.keys(tool).sort()).toEqual([
        'annotations',
        'description',
        'inputSchema',
        'name',
        'outputSchema',
      ]);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
      expect(tool.inputSchema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
    }
  });

  it('preserves nested constraints, required fields, and read/write annotations', () => {
    const reference = getMcpToolReference();
    const select = reference.find(tool => tool.name === 'select_voicing')!;
    expect(select.inputSchema).toMatchObject({
      required: ['index'],
      additionalProperties: false,
      properties: {
        index: { type: 'integer', minimum: 0, maximum: 19 },
        sessionId: { type: 'string', maxLength: 100 },
        expectedRevision: { type: 'integer', minimum: 0 },
      },
    });
    expect(select.outputSchema).toMatchObject({
      properties: {
        data: {
          properties: {
            settings: {
              properties: {
                numberOfFrets: { type: 'integer', minimum: 1, maximum: 24 },
              },
            },
          },
        },
      },
    });
    expect(select.annotations.readOnlyHint).toBe(false);
    expect(
      reference.find(tool => tool.name === 'identify_chord')!.annotations
        .readOnlyHint,
    ).toBe(true);
  });
});
