import { AvatarChat } from '../components/AvatarChat';

export default function AvatarChatPage() {
  return (
    <div className="h-screen bg-gray-100">
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow h-full overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h1 className="text-lg font-medium leading-6 text-gray-900">
              AI Avatar Chat
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Chat with AI avatars that imitate real users
            </p>
          </div>
          <div className="h-[calc(100%-5rem)]">
            <AvatarChat />
          </div>
        </div>
      </div>
    </div>
  )
} 