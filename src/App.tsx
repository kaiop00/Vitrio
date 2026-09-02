import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { StoresPage } from './pages/admin/StoresPage';
import { AccessPage } from './pages/admin/AccessPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { ProductsPage } from './pages/store/ProductsPage';
import { StoreSettingsPage } from './pages/store/StoreSettingsPage';
import { StorefrontPage } from './pages/store/StorefrontPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CheckoutSettingsPage } from './pages/store/CheckoutSettingsPage';
import { OrdersPage } from './pages/store/OrdersPage';
import { InventoryPage } from './pages/store/InventoryPage';
import { CategoriesPage } from './pages/store/CategoriesPage';
import { CashPage } from './pages/store/CashPage';
import { ReportsPage } from './pages/store/ReportsPage';
import { PaymentsPage } from './pages/store/PaymentsPage';
import { TeamPage } from './pages/store/TeamPage';
import { ReturnsPage } from './pages/store/ReturnsPage';
import { AuditPage } from './pages/store/AuditPage';
import { CouponsPage } from './pages/store/CouponsPage';
import { DeliveryZonesPage } from './pages/store/DeliveryZonesPage';
import { CustomersPage } from './pages/store/CustomersPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SubscriptionPage } from './pages/store/SubscriptionPage';
import { NotificationsPage } from './pages/store/NotificationsPage';
import { OnboardingPage } from './pages/store/OnboardingPage';
import { ActivityPage } from './pages/store/ActivityPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { SupportPage } from './pages/admin/SupportPage';
import { PromotionPage } from './pages/store/PromotionPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';


export default function App(){return <Routes>
 <Route path="/" element={<HomePage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/recuperar-senha" element={<ForgotPasswordPage/>}/><Route path="/verificar-email" element={<ProtectedRoute><VerifyEmailPage/></ProtectedRoute>}/><Route path="/cadastro" element={<RegisterPage/>}/><Route path="/loja/:slug" element={<StorefrontPage/>}/><Route path="/acompanhar/:orderId" element={<OrderTrackingPage/>}/>
 <Route element={<ProtectedRoute roles={['merchant']}><AppShell/></ProtectedRoute>}><Route path="/painel" element={<ProtectedRoute permission="dashboard"><DashboardPage/></ProtectedRoute>}/><Route path="/painel/atividade" element={<ActivityPage/>}/><Route path="/painel/produtos" element={<ProtectedRoute permission="products"><ProductsPage/></ProtectedRoute>}/><Route path="/painel/categorias" element={<ProtectedRoute permission="categories"><CategoriesPage/></ProtectedRoute>}/><Route path="/painel/estoque" element={<ProtectedRoute permission="inventory"><InventoryPage/></ProtectedRoute>}/><Route path="/painel/pedidos" element={<ProtectedRoute permission="orders"><OrdersPage/></ProtectedRoute>}/><Route path="/painel/devolucoes" element={<ProtectedRoute permission="returns"><ReturnsPage/></ProtectedRoute>}/><Route path="/painel/caixa" element={<ProtectedRoute permission="cash"><CashPage/></ProtectedRoute>}/><Route path="/painel/clientes" element={<ProtectedRoute permission="customers"><CustomersPage/></ProtectedRoute>}/><Route path="/painel/cupons" element={<ProtectedRoute permission="coupons"><CouponsPage/></ProtectedRoute>}/><Route path="/painel/entregas" element={<ProtectedRoute permission="delivery"><DeliveryZonesPage/></ProtectedRoute>}/><Route path="/painel/relatorios" element={<ProtectedRoute permission="reports"><ReportsPage/></ProtectedRoute>}/><Route path="/painel/pagamentos" element={<ProtectedRoute permission="payments"><PaymentsPage/></ProtectedRoute>}/><Route path="/painel/equipe" element={<TeamPage/>}/><Route path="/painel/auditoria" element={<ProtectedRoute permission="audit"><AuditPage/></ProtectedRoute>}/><Route path="/painel/minha-loja" element={<ProtectedRoute permission="store_settings"><StoreSettingsPage/></ProtectedRoute>}/><Route path="/painel/divulgacao" element={<PromotionPage/>}/><Route path="/painel/configuracoes" element={<ProtectedRoute permission="checkout_settings"><CheckoutSettingsPage/></ProtectedRoute>}/><Route path="/painel/primeiros-passos" element={<OnboardingPage/>}/><Route path="/painel/avisos" element={<NotificationsPage/>}/><Route path="/painel/assinatura" element={<SubscriptionPage/>}/></Route>
 <Route element={<ProtectedRoute roles={['admin']}><AppShell/></ProtectedRoute>}><Route path="/admin" element={<AdminDashboardPage/>}/><Route path="/admin/lojas" element={<StoresPage/>}/><Route path="/admin/acessos" element={<AccessPage/>}/><Route path="/admin/auditoria" element={<AdminAuditPage/>}/><Route path="/admin/suporte/:storeId" element={<SupportPage/>}/><Route path="/admin/configuracoes" element={<AdminSettingsPage/>}/></Route>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>}
