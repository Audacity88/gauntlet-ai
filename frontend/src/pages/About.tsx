import { memo } from 'react';

const About = memo(function About() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-black mb-4">About Gauntlet AI</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-black mb-4">Overview</h2>
        <p className="text-black mb-4">
          Gauntlet AI is a modern real-time chat application built with React, TypeScript, and Supabase.
          It features real-time messaging, file sharing, and presence indicators.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-black mb-4">Features</h2>
        <ul className="list-disc list-inside space-y-2 text-black">
          <li>Real-time messaging with instant updates</li>
          <li>Direct messaging and channel-based communication</li>
          <li>File sharing and attachment support</li>
          <li>User presence indicators</li>
          <li>Message search and filtering</li>
          <li>Modern, responsive UI</li>
          <li>Comprehensive error handling</li>
          <li>Accessibility features</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-black mb-4">Technology Stack</h2>
        <ul className="list-disc list-inside space-y-2 text-black">
          <li>React with TypeScript</li>
          <li>Supabase for backend and real-time features</li>
          <li>TailwindCSS for styling</li>
          <li>Zustand for state management</li>
          <li>React Router for navigation</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-black mb-4">Contact</h2>
        <p className="text-black">
          For support or inquiries, please contact us at{' '}
          <a 
            href="mailto:dan.gilles@gauntletai.com"
            className="text-indigo-600 hover:text-indigo-700"
          >
            dan.gilles@gauntletai.com
          </a>
        </p>
      </section>
    </div>
  );
});

export default About; 