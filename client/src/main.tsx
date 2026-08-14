import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <LoginModalProvider>
            <App />
          </LoginModalProvider>
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
