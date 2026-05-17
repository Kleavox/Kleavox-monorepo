// crates/web/src/main.rs

use components::header::Header;
use components::youtube::LivePlayer;
use gloo_net::http::Request;
use leptos::prelude::*;
use pages::dashboard::Dashboard;

mod components;
mod pages;

#[derive(Clone, Debug, serde::Deserialize)]
struct UserInfo {
    login: String,
}

async fn fetch_me() -> Result<UserInfo, ()> {
    let resp = Request::get("/api/auth/me").send().await.map_err(|_| ())?;
    if resp.ok() { resp.json::<UserInfo>().await.map_err(|_| ()) } else { Err(()) }
}

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(App);
}

#[component]
fn App() -> impl IntoView {
    let user = LocalResource::new(|| fetch_me());

    move || match user.read().as_deref() {
        None => view! {
            <div class="h-screen bg-db-bg flex items-center justify-center">
                <span class="mono text-xs text-db-muted animate-pulse-dot">"..."</span>
            </div>
        }.into_any(),
        Some(Err(_)) => view! { <LoginPage /> }.into_any(),
        Some(Ok(u)) => {
            let login = u.login.clone();
            view! {
                <div class="flex flex-col h-screen overflow-hidden bg-db-bg">
                    <Header login=login />
                    <Dashboard />
                    <LivePlayer />
                </div>
            }.into_any()
        }
    }
}

#[component]
fn LoginPage() -> impl IntoView {
    view! {
        <div class="h-screen bg-db-bg flex items-center justify-center">
            <div class="border border-db-border rounded-sm p-8 bg-db-surface w-full max-w-xs">
                <p class="font-semibold text-db-text mb-0.5">"▪ deauboard"</p>
                <p class="mono text-xs text-db-muted mb-6">"workplace"</p>
                <a
                    href="/api/auth/github"
                    class="flex items-center justify-center gap-2 w-full py-2 border border-db-border rounded-sm mono text-xs text-db-text hover:bg-db-subtle transition-colors"
                >
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    "continue with github"
                </a>
            </div>
        </div>
    }
}
