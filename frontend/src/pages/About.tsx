import React from 'react';

const About = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">ChatGenius: Smarter Workplace Communication with AI</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Background</h2>
        <p className="text-gray-700 mb-4">
          Chat apps, such as Slack, are a foundational element of the modern workplace. If you work remotely, they are the workplace
          - and even if you work in-person, chat apps enable asynchronous collaboration and integration with other common tools.
        </p>
        <p className="text-gray-700 mb-4">
          But chat apps aren't perfect - written text lacks the nuance of voice and facial expressions. 
          Chatting can be less engaging, or even less accurate, with people missing key pieces of information.
        </p>
        <p className="text-gray-700">
          ChatGenius tackles this by applying generative AI, not to replace humans but to augment them. 
          It gives the user a professional digital twin, an AI avatar that can represent them but still have a personal touch.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Core Features</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Authentication</li>
          <li>Real-time messaging</li>
          <li>Channel/DM organization</li>
          <li>File sharing & search</li>
          <li>User presence & status</li>
          <li>Thread support</li>
          <li>Emoji reactions</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">AI Capabilities</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-medium mb-2">Baseline Features</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Context-aware communication on behalf of users</li>
              <li>Personality mirroring to match user communication style</li>
              <li>Automatic response handling without user intervention</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-medium mb-2">Advanced Features</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Voice synthesis for message delivery</li>
              <li>Video synthesis with visual avatars</li>
              <li>Customizable avatar appearance</li>
              <li>Gesture and expression generation</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About; 