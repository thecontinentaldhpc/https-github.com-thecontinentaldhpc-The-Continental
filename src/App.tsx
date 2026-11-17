import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SiteProvider } from './context/SiteContext';
import { Masthead } from './components/Masthead';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { ArticlePage } from './pages/ArticlePage';
import { PublishWritingPage } from './pages/PublishWritingPage';
import { MagazinePage } from './pages/MagazinePage';
import { EpaperPage } from './pages/EpaperPage';
import { SearchPage } from './pages/SearchPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PolicyPage } from './pages/PolicyPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { ReadingListPage } from './pages/ReadingListPage';
import { LoginModal } from './components/LoginModal';

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <div className="min-h-screen flex flex-col bg-white dark:bg-[#121212] text-neutral-900 dark:text-neutral-100 transition-colors duration-150">
          <Masthead />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/world" element={<CategoryPage slug="world" title="World" />} />
              <Route path="/india" element={<CategoryPage slug="india" title="India" />} />
              <Route path="/regional" element={<CategoryPage slug="regional" title="Regional" />} />
              <Route path="/politics" element={<CategoryPage slug="politics" title="Politics" />} />
              <Route path="/business" element={<CategoryPage slug="business" title="Business" />} />
              <Route path="/economy" element={<CategoryPage slug="economy" title="Economy" />} />
              <Route path="/education" element={<CategoryPage slug="education" title="Education" />} />
              <Route path="/science-technology" element={<CategoryPage slug="science-technology" title="Science & Technology" />} />
              <Route path="/environment" element={<CategoryPage slug="environment" title="Environment" />} />
              <Route path="/sports" element={<CategoryPage slug="sports" title="Sports" />} />
              <Route path="/opinion" element={<CategoryPage slug="opinion" title="Opinion" />} />
              <Route path="/editorial" element={<CategoryPage slug="editorial" title="Editorial" />} />

              <Route path="/article/:slug" element={<ArticlePage />} />
              <Route path="/reading-list" element={<ReadingListPage />} />
              <Route path="/magazine" element={<MagazinePage />} />
              <Route path="/epaper" element={<EpaperPage />} />
              <Route path="/publish-your-writing" element={<PublishWritingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/search" element={<SearchPage />} />

              <Route
                path="/editorial-policy"
                element={<PolicyPage title="Editorial Policy" settingKey="editorial_policy" />}
              />
              <Route
                path="/corrections-policy"
                element={<PolicyPage title="Corrections Policy" settingKey="corrections_policy" />}
              />
              <Route
                path="/privacy-policy"
                element={<PolicyPage title="Privacy Policy" settingKey="privacy_policy" />}
              />
              <Route
                path="/terms"
                element={<PolicyPage title="Terms and Conditions" settingKey="terms_conditions" />}
              />

              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </div>
        <LoginModal />
      </SiteProvider>
    </BrowserRouter>
  );
}
