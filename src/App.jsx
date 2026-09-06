import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider, Spinner } from './components/ui/index.js'
import { Shell } from './components/Shell.jsx'
import { SyncProvider } from './lib/sync/SyncProvider.jsx'
import { AdoptLocalDialog } from './components/account/AdoptLocalDialog.jsx'

const Library = lazy(() => import('./pages/Library.jsx'))
const Projects = lazy(() => import('./pages/Projects.jsx'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Account = lazy(() => import('./pages/Account.jsx'))
const ScoreViewer = lazy(() => import('./pages/ScoreViewer.jsx'))
const PageManager = lazy(() => import('./pages/PageManager.jsx'))
const Performance = lazy(() => import('./pages/Performance.jsx'))

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-gold-300">
      <Spinner className="size-8" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SyncProvider>
          <AdoptLocalDialog />
          <Suspense fallback={<Loading />}>
            <Routes>
            <Route element={<Shell />}>
              <Route index element={<Library />} />
              <Route path="projekt" element={<Projects />} />
              <Route path="projekt/:projectId" element={<ProjectDetail />} />
              <Route path="installningar" element={<Settings />} />
              <Route path="konto" element={<Account />} />
            </Route>
            <Route path="noter/:scoreId" element={<ScoreViewer />} />
            <Route path="noter/:scoreId/sidor" element={<PageManager />} />
            <Route path="projekt/:projectId/spela" element={<Performance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </SyncProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
