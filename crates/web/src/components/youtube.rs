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

pub static LIVE_STATUS: std::sync::OnceLock<RwSignal<Option<LiveStatus>>> = std::sync::OnceLock::new();
pub static SHOW_PLAYER: std::sync::OnceLock<RwSignal<bool>> = std::sync::OnceLock::new();

fn get_live_signal() -> RwSignal<Option<LiveStatus>> {
    *LIVE_STATUS.get_or_init(|| RwSignal::new(None))
}

fn get_show_player_signal() -> RwSignal<bool> {
    *SHOW_PLAYER.get_or_init(|| RwSignal::new(false))
}

#[component]
pub fn YoutubeWatcher() -> impl IntoView {
    let channel = RwSignal::new(
        LocalStorage::get::<String>("yt_channel").unwrap_or_default()
    );
    let show_input = RwSignal::new(false);
    let input_val = RwSignal::new(channel.get_untracked());
    let live = get_live_signal();

    let check = move || {
        let ch = channel.get();
        if ch.is_empty() { return; }
        leptos::task::spawn_local(async move {
            if let Ok(resp) = Request::get(&format!("/api/youtube/check?channel={ch}")).send().await {
                if let Ok(s) = resp.json::<LiveStatus>().await {
                    live.set(Some(s));
                }
            }
        });
    };

    Effect::new(move |_| {
        if !channel.get().is_empty() { check(); }
    });

    let save_channel = move |val: String| {
        let val = val.trim().to_string();
        channel.set(val.clone());
        let _ = LocalStorage::set("yt_channel", &val);
        show_input.set(false);
        live.set(None);
        if !val.is_empty() { check(); }
    };

    view! {
        <div class="flex items-center gap-2 relative">
            {move || {
                let status = live.get();
                let ch = channel.get();

                if ch.is_empty() {
                    view! {
                        <button
                            class="mono text-xs text-db-muted hover:text-db-text transition-colors cursor-pointer"
                            on:click=move |_| show_input.update(|v| *v = !*v)
                        >"+ watch channel"</button>
                    }.into_any()
                } else {
                    match status.as_ref() {
                        Some(s) if s.live => view! {
                            <button
                                class="flex items-center gap-1.5 cursor-pointer"
                                on:click=move |_| get_show_player_signal().update(|v| *v = !*v)
                            >
                                <span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot"/>
                                <span class="mono text-xs text-live font-medium">"LIVE"</span>
                                {s.title.as_ref().map(|t| {
                                    let t = if t.len() > 20 { format!("{}…", &t[..20]) } else { t.clone() };
                                    view! { <span class="mono text-xs text-db-muted hidden md:block">{t}</span> }
                                })}
                            </button>
                        }.into_any(),
                        _ => view! {
                            <button
                                class="flex items-center gap-1.5 cursor-pointer"
                                on:click=move |_| show_input.update(|v| *v = !*v)
                            >
                                <span class="w-1.5 h-1.5 rounded-full bg-db-border"/>
                                <span class="mono text-xs text-db-muted">{ch}</span>
                            </button>
                        }.into_any(),
                    }
                }
            }}

            {move || show_input.get().then(|| view! {
                <div class="absolute right-0 top-7 z-50 bg-db-surface border border-db-border rounded-sm p-2 shadow-sm w-48">
                    <input
                        type="text"
                        placeholder="@channel"
                        class="mono text-xs w-full px-2 py-1 border border-db-border rounded-sm bg-db-bg focus:outline-none focus:border-db-text"
                        prop:value=move || input_val.get()
                        on:input=move |ev| input_val.set(event_target_value(&ev))
                        on:keydown=move |ev| {
                            if ev.key() == "Enter" { save_channel(input_val.get()); }
                            if ev.key() == "Escape" { show_input.set(false); }
                        }
                        autofocus=true
                    />
                    <div class="flex gap-1 mt-1.5">
                        <button
                            class="flex-1 mono text-xs py-1 bg-db-text text-db-surface rounded-sm cursor-pointer hover:opacity-80"
                            on:click=move |_| save_channel(input_val.get())
                        >"Set"</button>
                        <button
                            class="mono text-xs px-2 py-1 border border-db-border rounded-sm cursor-pointer hover:bg-db-subtle text-db-muted"
                            on:click=move |_| { save_channel(String::new()); show_input.set(false); }
                        >"Clear"</button>
                    </div>
                </div>
            })}
        </div>
    }
}

#[component]
pub fn LivePlayer() -> impl IntoView {
    let live = get_live_signal();
    let show = get_show_player_signal();

    move || {
        let status = live.get();
        let visible = show.get();
        if !visible { return view! { <div/> }.into_any(); }

        match status.as_ref().and_then(|s| s.video_id.as_ref()) {
            None => view! { <div/> }.into_any(),
            Some(vid) => {
                let vid = vid.clone();
                view! {
                    <div class="fixed bottom-4 right-4 z-50 w-80 shadow-lg border border-db-border rounded-sm bg-db-surface overflow-hidden">
                        <div class="flex items-center justify-between px-3 py-1.5 border-b border-db-border">
                            <span class="mono text-xs text-live font-medium">"● LIVE"</span>
                            <button
                                class="mono text-xs text-db-muted hover:text-db-text cursor-pointer"
                                on:click=move |_| show.set(false)
                            >"✕"</button>
                        </div>
                        <div class="aspect-video">
                            <iframe
                                class="w-full h-full"
                                src=format!("https://www.youtube.com/embed/{vid}?autoplay=1")
                                allow="autoplay; encrypted-media"
                                allowfullscreen=true
                            />
                        </div>
                        <div class="px-3 py-1.5 border-t border-db-border">
                            <a
                                href=format!("https://www.youtube.com/watch?v={vid}")
                                target="_blank"
                                class="mono text-xs text-db-muted hover:text-db-text transition-colors"
                            >"open in youtube →"</a>
                        </div>
                    </div>
                }.into_any()
            }
        }
    }
}
