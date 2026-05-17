// crates/web/src/components/youtube.rs

use gloo_net::http::Request;
use gloo_storage::{LocalStorage, Storage};
use leptos::prelude::*;

#[derive(Clone, Debug, serde::Deserialize, Default)]
pub struct LiveStatus {
    pub live: bool,
    pub video_id: Option<String>,
    pub title: Option<String>,
}

pub static LIVE: std::sync::OnceLock<RwSignal<Option<LiveStatus>>> = std::sync::OnceLock::new();
pub static SHOW_PLAYER: std::sync::OnceLock<RwSignal<bool>> = std::sync::OnceLock::new();

pub fn live_signal() -> RwSignal<Option<LiveStatus>> {
    *LIVE.get_or_init(|| RwSignal::new(None))
}
pub fn show_player_signal() -> RwSignal<bool> {
    *SHOW_PLAYER.get_or_init(|| RwSignal::new(false))
}

#[component]
pub fn YoutubeWatcher() -> impl IntoView {
    let channel = RwSignal::new(LocalStorage::get::<String>("yt_channel").unwrap_or_default());
    let show_input = RwSignal::new(false);
    let input_val = RwSignal::new(channel.get_untracked());
    let live = live_signal();

    let do_check = move || {
        let ch = channel.get();
        if ch.is_empty() { return; }
        leptos::task::spawn_local(async move {
            if let Ok(r) = Request::get(&format!("/api/youtube/check?channel={ch}")).send().await {
                if let Ok(s) = r.json::<LiveStatus>().await {
                    live.set(Some(s));
                }
            }
        });
    };

    Effect::new(move |_| { if !channel.get().is_empty() { do_check(); } });

    let save = move |val: String| {
        let val = val.trim().to_string();
        channel.set(val.clone());
        let _ = LocalStorage::set("yt_channel", &val);
        show_input.set(false);
        live.set(None);
        if !val.is_empty() { do_check(); }
    };

    view! {
        <div class="flex items-center gap-2 relative">
            {move || {
                let ch = channel.get();
                let status = live.get();
                if ch.is_empty() {
                    view! {
                        <button
                            class="mono text-xs text-db-muted hover:text-db-text transition-colors cursor-pointer"
                            on:click=move |_| show_input.update(|v| *v = !*v)
                        >"[+ watch]"</button>
                    }.into_any()
                } else {
                    match status.as_ref() {
                        Some(s) if s.live => view! {
                            <button
                                class="mono text-xs flex items-center gap-1.5 cursor-pointer"
                                on:click=move |_| show_player_signal().update(|v| *v = !*v)
                            >
                                <span class="inline-block w-1.5 h-1.5 rounded-full bg-live animate-pulse-slow"/>
                                <span class="text-live font-bold">"LIVE"</span>
                                {s.title.as_ref().map(|t| {
                                    let t = if t.len() > 22 { format!("{}…", &t[..22]) } else { t.clone() };
                                    view! { <span class="text-db-muted hidden md:block">{t}</span> }
                                })}
                            </button>
                        }.into_any(),
                        _ => view! {
                            <button
                                class="mono text-xs flex items-center gap-1.5 cursor-pointer"
                                on:click=move |_| show_input.update(|v| *v = !*v)
                            >
                                <span class="inline-block w-1.5 h-1.5 rounded-full bg-db-border animate-pulse-slow"/>
                                <span class="text-db-muted">{ch}</span>
                            </button>
                        }.into_any(),
                    }
                }
            }}

            {move || show_input.get().then(|| view! {
                <div class="absolute right-0 top-8 z-50 bg-db-s2 border border-db-border rounded-sm p-2 shadow-2xl w-52">
                    <p class="mono text-xs text-db-muted mb-1.5">"watch channel:"</p>
                    <input
                        type="text" placeholder="@handle"
                        class="mono text-xs w-full px-2 py-1 border border-db-border rounded-sm bg-db-bg text-db-text focus:outline-none focus:border-sky"
                        prop:value=move || input_val.get()
                        on:input=move |ev| input_val.set(event_target_value(&ev))
                        on:keydown=move |ev| {
                            match ev.key().as_str() {
                                "Enter" => save(input_val.get()),
                                "Escape" => show_input.set(false),
                                _ => {}
                            }
                        }
                        autofocus=true
                    />
                    <div class="flex gap-1 mt-2">
                        <button
                            class="flex-1 mono text-xs py-1 bg-db-text text-db-bg rounded-sm cursor-pointer hover:opacity-80"
                            on:click=move |_| save(input_val.get())
                        >"set"</button>
                        <button
                            class="mono text-xs px-2 py-1 border border-db-border rounded-sm cursor-pointer hover:bg-db-dim text-db-muted"
                            on:click=move |_| { save(String::new()); }
                        >"clear"</button>
                    </div>
                </div>
            })}
        </div>
    }
}

#[component]
pub fn LivePlayer() -> impl IntoView {
    let live = live_signal();
    let show = show_player_signal();

    move || {
        if !show.get() { return view! { <div/> }.into_any(); }
        let Some(status) = live.get() else { return view! { <div/> }.into_any(); };
        let Some(vid) = status.video_id else { return view! { <div/> }.into_any(); };

        view! {
            <div class="fixed bottom-4 right-4 z-50 w-72 border border-db-border bg-db-surface shadow-2xl rounded-sm overflow-hidden animate-fade-in">
                <div class="flex items-center justify-between px-3 py-1.5 border-b border-db-border">
                    <span class="mono text-xs text-live font-bold">"● LIVE"</span>
                    <div class="flex items-center gap-3">
                        <a
                            href=format!("https://youtube.com/watch?v={vid}")
                            target="_blank"
                            class="mono text-xs text-db-muted hover:text-db-text"
                        >"↗ open"</a>
                        <button
                            class="mono text-xs text-db-muted hover:text-down cursor-pointer"
                            on:click=move |_| show.set(false)
                        >"✕"</button>
                    </div>
                </div>
                <div class="aspect-video">
                    <iframe
                        class="w-full h-full"
                        src=format!("https://www.youtube.com/embed/{vid}?autoplay=1")
                        allow="autoplay; encrypted-media"
                        allowfullscreen=true
                    />
                </div>
            </div>
        }.into_any()
    }
}
