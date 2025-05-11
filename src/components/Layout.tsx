
import React from 'react';
import { UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-primary">ShiftManager</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center">
              <UserCircle className="h-5 w-5 mr-2" />
              <span>Admin</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} ShiftManager. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
