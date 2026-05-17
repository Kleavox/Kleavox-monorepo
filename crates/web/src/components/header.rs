// crates/web/src/components/header.rs

use crate::components::youtube::YoutubeWatcher;
use gloo_net::http::Request;
use leptos::prelude::*;

#[component]
pub fn Header(login: String) -> impl IntoView {
    let on_logout = move |_| {
        leptos::task::spawn_local(async {
            let _ = Request::post("/api/auth/logout").send().await;
            leptos::web_sys::window().unwrap().location().reload().unwrap();
        });
    };

    view! {
        <header class="flex-none h-10 bg-db-surface border-b border-db-border
                       flex items-center px-4 gap-6 justify-between select-none">
            <span class="mono text-sm text-db-text font-bold tracking-tight shrink-0">
                "▪ deauboard"
            </span>
            <div class="flex items-center gap-5 ml-auto">
                <YoutubeWatcher />
                <span class="text-db-border">"|"</span>
                <span class="mono text-xs text-db-muted">{login}</span>
                <button
                    class="mono text-xs text-db-muted hover:text-down transition-colors cursor-pointer"
                    on:click=on_logout
                >"exit"</button>
            </div>
        </header>
    }
}
