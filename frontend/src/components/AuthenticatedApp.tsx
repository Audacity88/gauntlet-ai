import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { routes, RouteConfig } from '../routes';
import { ProtectedRoute } from './ProtectedRoute';

export function AuthenticatedApp() {
  const renderRoute = (route: RouteConfig) => {
    const Element = route.element;
    return route.protected ? (
      <ProtectedRoute>
        <Element />
      </ProtectedRoute>
    ) : (
      <Element />
    );
  };

  return (
    <Layout>
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={renderRoute(route)}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
} 