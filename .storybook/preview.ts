import type { Preview } from '@storybook/react';
import { createElement } from 'react';
import { ContextProviders } from '../app/components/ContextProviders';

const preview: Preview = {
  decorators: [
    Story => createElement(ContextProviders, null, createElement(Story)),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
