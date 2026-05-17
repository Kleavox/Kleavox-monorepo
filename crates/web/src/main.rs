use gloo_net::http::Request;
use leptos::prelude::*;

mod components;
mod pages;

#[derive(Clone, Debug, serde::Deserialize)]
struct UserInfo {
    login: String,
}

async fn fetch_me() -> Result<UserInfo, ()> {
    let resp = Request::get("/api/auth/me")
        .send()
        .await
        .map_err(|_| ())?;
    if resp.ok() {
        resp.json::<UserInfo>().await.map_err(|_| ())
    } else {
        Err(())
    }
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
            <div class="min-h-screen bg-db-bg flex items-center justify-center">
                <div class="flex items-center gap-2 text-db-muted text-sm">
                    <span class="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin inline-block"/>
                    "Memuat..."
                </div>
            </div>
        }.into_any(),
        Some(Err(_)) => view! { <LoginPage /> }.into_any(),
        Some(Ok(u)) => view! {
            <div class="min-h-screen bg-db-bg flex flex-col">
                <Header login=u.login.clone() />
                <main class="max-w-3xl w-full mx-auto px-4 py-8 animate-fade-up flex-1">
                    <pages::Dashboard />
                </main>
                <footer class="max-w-3xl mx-auto w-full px-4 py-4 flex items-center justify-between">
                    <span class="text-xs text-db-muted">"© Deauboard"</span>
                    <span class="text-xs text-db-muted font-mono">
                        "v" {env!("CARGO_PKG_VERSION")}
                    </span>
                </footer>
            </div>
        }.into_any(),
    }
}

#[component]
fn Header(login: String) -> impl IntoView {
    let on_logout = move |_| {
        leptos::task::spawn_local(async {
            let _ = Request::post("/api/auth/logout").send().await;
            leptos::web_sys::window().unwrap().location().reload().unwrap();
        });
    };

    view! {
        <header class="bg-white border-b border-db-border sticky top-0 z-10 backdrop-blur-sm bg-white/90">
            <div class="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
                        <span class="text-white font-bold text-sm">"D"</span>
                    </div>
                    <span class="font-semibold text-db-text tracking-tight">"Deauboard"</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-db-muted hidden sm:block">{login}</span>
                    <button
                        class="text-xs text-db-muted hover:text-red-500 transition-colors duration-150 px-2 py-1 rounded hover:bg-red-50 cursor-pointer"
                        on:click=on_logout
                    >
                        "Logout"
                    </button>
                </div>
            </div>
        </header>
    }
}

#[component]
fn LoginPage() -> impl IntoView {
    view! {
        <div class="min-h-screen bg-db-bg flex items-center justify-center p-4">
            <div class="w-full max-w-sm animate-fade-up">
                <div class="text-center mb-8">
                    <div class="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                        <span class="text-white font-bold text-2xl">"D"</span>
                    </div>
                    <h1 class="text-xl font-semibold text-db-text">"Deauboard"</h1>
                    <p class="text-sm text-db-muted mt-1">"Project tracker & uptime monitor"</p>
                </div>
                <div class="bg-white border border-db-border rounded-2xl p-6 shadow-sm">
                    <p class="text-sm text-db-muted text-center mb-4">"Login untuk melanjutkan"</p>
                    <a
                        href="/api/auth/github"
                        class="flex items-center justify-center gap-2.5 w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors duration-150"
                    >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        "Login dengan GitHub"
                    </a>
                </div>
            </div>
        </div>
    }
}
