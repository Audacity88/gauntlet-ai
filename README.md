# Gauntlet AI - ChatGenius

A modern real-time chat application built with React, TypeScript, and Vite that enhances workplace communication through AI-powered features.

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Supabase for backend services

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gauntlet-ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## ESLint Configuration

For production applications, we use type-aware lint rules. The configuration includes:

```js
export default tseslint.config({
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

### Enhanced ESLint Setup

We use the following ESLint configurations:

- `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked` for type checking
- `tseslint.configs.stylisticTypeChecked` for code style (optional)
- `eslint-plugin-react` for React-specific rules

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  settings: { react: { version: '18.3' } },
  plugins: {
    react,
  },
  rules: {
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Features

- Real-time messaging
- Channel/DM organization
- File sharing & search
- User presence & status
- Thread support
- Emoji reactions
- AI-powered features (coming soon)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
