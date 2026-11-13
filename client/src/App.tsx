import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminTaxonomyPage } from './pages/AdminTaxonomyPage'
import { EditorPage } from './pages/EditorPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyPostsPage } from './pages/MyPostsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="posts/:slug" element={<PostDetailPage />} />
              <Route
                path="posts/:slug/edit"
                element={
                  <ProtectedRoute>
                    <EditorPage mode="edit" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="write"
                element={
                  <ProtectedRoute>
                    <EditorPage mode="create" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-posts"
                element={
                  <ProtectedRoute>
                    <MyPostsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/taxonomy"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminTaxonomyPage />
                  </ProtectedRoute>
                }
              />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
