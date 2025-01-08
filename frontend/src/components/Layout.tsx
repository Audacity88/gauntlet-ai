import { Link } from 'react-router-dom'
import { StatusManager } from './StatusManager'
import { supabase } from '../lib/supabaseClient'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-800 text-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-indigo-700">
          <h1 className="text-2xl font-bold tracking-tight">ChatGenius</h1>
        </div>

        {/* User section */}
        <div className="p-4 border-b border-indigo-700">
          <div className="flex items-center space-x-2">
            <StatusManager />
            <button 
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-indigo-200 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link 
            to="/" 
            className="block px-3 py-2 text-indigo-100 hover:bg-indigo-700 rounded-md"
          >
            Home
          </Link>
          <Link 
            to="/profile" 
            className="block px-3 py-2 text-indigo-100 hover:bg-indigo-700 rounded-md"
          >
            Profile
          </Link>
          <Link 
            to="/about" 
            className="block px-3 py-2 text-indigo-100 hover:bg-indigo-700 rounded-md"
          >
            About
          </Link>
          <Link 
            to="/messages" 
            className="block px-3 py-2 text-indigo-100 hover:bg-indigo-700 rounded-md"
          >
            Messages
          </Link>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content body */}
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  )
} 