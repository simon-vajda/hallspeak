import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://hallspeak.app',
  integrations: [
    starlight({
      title: 'Hallspeak',
      description:
        'Self-hosted simultaneous interpretation for live, in-person events. Listeners hear the interpreter on their own phones.',
      logo: { src: './src/assets/logo-mark.svg' },
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        },
        { tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/simon-vajda/hallspeak' },
      ],
      customCss: ['./src/styles/theme.css'],
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            'getting-started/installation',
            'getting-started/hosting',
            'getting-started/upgrading-and-troubleshooting',
          ],
        },
        'privacy',
      ],
    }),
  ],
});
