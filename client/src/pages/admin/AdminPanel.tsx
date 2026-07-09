import { useLocation } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";

const AdminPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <AdminLayout activePath={pathname}>
      {children}
    </AdminLayout>
  );
};

export { AdminPanel }