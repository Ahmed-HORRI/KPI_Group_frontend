import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import KpiAdminPage from "./pages/KPIs/KpiAdminPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/kpi-admin" element={<KpiAdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
