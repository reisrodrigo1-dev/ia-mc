'use client';

import { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  MessageSquare,
  Plus,
  Settings,
  LogOut,
  Users,
  Bot,
  FileText,
  Menu,
  X,
  Sparkles,
  Home,
  Wand2,
  ChevronDown,
  ChevronRight,
  Phone,
  BookOpen,
  MessageCircle,
  BarChart3,
  FileSpreadsheet,
  Upload,
  Search,
  FileCheck,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isSuperAdmin, canCreateSector } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [editaisOpen, setEditaisOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Nova Conversa', href: '/dashboard/new', icon: Plus },
    { name: 'Agentes', href: '/dashboard/agents', icon: Bot },
    { name: 'Prompts', href: '/dashboard/prompts', icon: FileText },
    { name: 'Assistente de Prompt', href: '/dashboard/prompt-assistant', icon: Wand2 },
  ];

  const whatsappSubMenu = [
    { name: 'Conexões', href: '/dashboard/whatsapp/connections', icon: Phone },
    { name: 'Treinamento', href: '/dashboard/whatsapp/training', icon: BookOpen },
    { name: 'Conversas', href: '/dashboard/whatsapp/chats', icon: MessageCircle },
    { name: 'Analytics', href: '/dashboard/whatsapp/analytics', icon: BarChart3 },
  ];

  const editaisSubMenu = [
    { name: 'Upload de Vídeo Aulas', href: '/dashboard/editais/upload', icon: Upload },
    { name: 'Analisar Edital', href: '/dashboard/editais/analisar', icon: Search },
    { name: 'Meus Editais', href: '/dashboard/editais/lista', icon: FileCheck },
  ];

  if (canCreateSector) {
    navigation.push({ name: 'Setores', href: '/dashboard/sectors', icon: Users });
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden shadow-lg fixed lg:relative h-screen z-50`}
      >
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">MeuCurso IA</h1>
              <p className="text-gray-600 text-sm">Sistema Inteligente</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-gray-100 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-orange-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
          
          {/* WhatsApp Dropdown */}
          <div>
            <button
              onClick={() => setWhatsappOpen(!whatsappOpen)}
              className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-xl transition-all duration-200 text-gray-700 hover:bg-gray-100 hover:text-orange-600"
            >
              <div className="flex items-center gap-4">
                <Phone className="w-5 h-5 text-gray-500" />
                <span className="font-medium">WhatsApp</span>
              </div>
              {whatsappOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {whatsappOpen && (
              <div className="mt-1 ml-4 space-y-1">
                {whatsappSubMenu.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-orange-600'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editais Dropdown */}
          <div>
            <button
              onClick={() => setEditaisOpen(!editaisOpen)}
              className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-xl transition-all duration-200 text-gray-700 hover:bg-gray-100 hover:text-orange-600"
            >
              <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-5 h-5 text-gray-500" />
                <span className="font-medium">Editais</span>
              </div>
              {editaisOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {editaisOpen && (
              <div className="mt-1 ml-4 space-y-1">
                {editaisSubMenu.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-orange-600'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* User Info */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-lg font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-600 truncate">{user?.email}</p>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="mt-3 px-4 py-3 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-xs text-orange-700 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Super Admin
              </p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-4 w-full px-4 py-4 mt-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:hidden shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="hover:bg-gray-100 p-2 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="ml-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">MeuCurso IA</span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
