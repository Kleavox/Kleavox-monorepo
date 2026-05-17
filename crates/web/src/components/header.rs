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
        <header class="flex-none h-11 bg-db-surface border-b border-db-border flex items-center px-4 gap-4 justify-between">
            <span class="font-semibold text-db-text text-sm tracking-tight shrink-0">"▪ deauboard"</span>
            <div class="flex items-center gap-4 ml-auto">
                <YoutubeWatcher />
                <div class="h-3 w-px bg-db-border"/>
                <span class="mono text-xs text-db-muted hidden sm:block">{login}</span>
                <button
                    class="mono text-xs text-db-muted hover:text-down transition-colors cursor-pointer"
                    on:click=on_logout
                >"logout"</button>
            </div>
        </header>
    }
}
