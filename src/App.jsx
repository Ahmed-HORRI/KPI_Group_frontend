import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import KpiAdminPage from "./pages/KPIs/KpiAdminPage.jsx";
import KpiTrendsPage from "./pages/KPIs/KpiTrendsPage.jsx";
import CeoReportPlantPage from "./pages/CeoReport/CeoReportPlantPage.jsx";
import TargetAdjustmentReviewPage from "./pages/TargetAdjustments/TargetAdjustmentReviewPage.jsx";
import DashboardPage from "./pages/Dashboard/DashboardPage.jsx";
import DashboardHistoryPage from "./pages/Dashboard/DashboardHistoryPage.jsx";
import TrainingCenterPage from "./pages/Training/TrainingCenterPage.jsx";
import TrainingDocumentationPage from "./pages/Training/TrainingDocumentationPage.jsx";
import TrainingDashboardPage from "./pages/Training/TrainingDashboardPage.jsx";
import CorrectiveActionsListPage from "./pages/CorrectiveActions/CorrectiveActionsListPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/kpi-admin" element={<KpiAdminPage />} />
          <Route path="/kpi-trends" element={<KpiTrendsPage />} />
          <Route path="/ceo-report/plants/:plantId" element={<CeoReportPlantPage />} />
          <Route path="/kpi-target-adjustments/review" element={<TargetAdjustmentReviewPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard-history" element={<DashboardHistoryPage />} />
          <Route path="/kpi-training-center" element={<TrainingCenterPage />} />
          <Route path="/kpi-training-documentation" element={<TrainingDocumentationPage />} />
          <Route path="/kpi-training-dashboard" element={<TrainingDashboardPage />} />
          <Route path="/corrective-actions-list" element={<CorrectiveActionsListPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
