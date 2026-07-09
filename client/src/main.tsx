import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { DevicePage } from "./pages/DevicePage";
import { HelpPage } from "./pages/HelpPage";
import { HubRoomPage } from "./pages/HubRoomPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { LoginPage } from "./pages/LoginPage";
import { RackPage } from "./pages/RackPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return localStorage.getItem("rack-token") ? <>{children}</> : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="hub-rooms/:id" element={<HubRoomPage />} />
          <Route path="racks/:id" element={<RackPage />} />
          <Route path="devices/:id" element={<DevicePage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
