// crates/web/src/pages/dashboard/mod.rs

use crate::components::youtube::YoutubePanel;
use deauboard_shared::{Note, Project, UptimeCheck};
use gloo_net::http::Request;
use leptos::prelude::*;

async fn fetch_all() -> (Vec<UptimeCheck>, Vec<Project>, Vec<Note>) {
    let u = async {
        let Ok(r) = Request::get("/api/uptime").send().await else { return vec![] };
        r.json::<Vec<UptimeCheck>>().await.unwrap_or_default()
    };
    let p = async {
        let Ok(r) = Request::get("/api/projects").send().await else { return vec![] };
        r.json::<Vec<Project>>().await.unwrap_or_default()
    };
    let n = async {
        let Ok(r) = Request::get("/api/notes").send().await else { return vec![] };
        r.json::<Vec<Note>>().await.unwrap_or_default()
    };
    (u.await, p.await, n.await)
}

#[derive(Clone)]
enum Modal { None, AddProject, EditProject(Project) }

#[component]
pub fn Dashboard() -> impl IntoView {
    let trigger = RwSignal::new(0u32);
    let modal = RwSignal::new(Modal::None);

    let data = LocalResource::new(move || {
        trigger.get();
        async { fetch_all().await }
    });

    view! {
        <div class="flex-1 flex flex-col overflow-hidden min-h-0">
            <div class="flex-1 flex overflow-hidden min-h-0">
                {move || match data.read().as_deref() {
                    None => view! {
                        <div class="flex-1 flex items-center justify-center">
                            <span class="mono text-xs text-db-muted animate-pulse-slow">"initializing..."</span>
                        </div>
                    }.into_any(),
                    Some((uptime, projects, _notes)) => view! {
                        <Sidebar checks=uptime.clone() />
                        <Board projects=projects.clone() trigger=trigger modal=modal />
                    }.into_any(),
                }}
            </div>

            <BottomPanel notes=match data.read().as_deref() {
                Some((_, _, n)) => n.clone(),
                None => vec![],
            } trigger=trigger />
        </div>

        {move || match modal.get() {
            Modal::None => view! { <div/> }.into_any(),
            Modal::AddProject => view! { <AddModal trigger=trigger modal=modal /> }.into_any(),
            Modal::EditProject(p) => view! { <EditModal project=p trigger=trigger modal=modal /> }.into_any(),
        }}
    }
}

// ─── LEFT SIDEBAR (VS Code explorer) ──────────────────────────────────────────

#[component]
fn Sidebar(checks: Vec<UptimeCheck>) -> impl IntoView {
    let mut nodes: Vec<(String, Vec<UptimeCheck>)> = vec![];
    for c in checks {
        if let Some(g) = nodes.iter_mut().find(|(n, _)| n == &c.node_name) {
            g.1.push(c);
        } else {
            nodes.push((c.node_name.clone(), vec![c]));
        }
    }

    view! {
        <div class="w-52 flex-none border-r border-db-border flex flex-col overflow-hidden bg-db-surface">
            <div class="panel-header">
                <span>"INFRA"</span>
                {
                    let total = nodes.iter().map(|(_, c)| c.len()).sum::<usize>();
                    let up = nodes.iter().flat_map(|(_, c)| c).filter(|c| c.status == "up").count();
                    view! {
                        <span class="text-db-border">{up} "/" {total}</span>
                    }
                }
            </div>
            <div class="flex-1 overflow-y-auto py-1">
                {if nodes.is_empty() {
                    view! {
                        <div class="px-3 py-2">
                            <p class="mono text-xs text-db-muted">"no agents connected"</p>
                            <p class="mono text-xs text-db-muted opacity-50 mt-1 leading-relaxed">
                                "curl board.deau.site" <br/> "/install.sh | sh"
                            </p>
                        </div>
                    }.into_any()
                } else {
                    view! {
                        <div>
                            {nodes.into_iter().map(|(node, checks)| {
                                let all_up = checks.iter().all(|c| c.status == "up");
                                view! {
                                    <div class="mb-1">
                                        <div class="flex items-center gap-1.5 px-3 py-1 hover:bg-db-dim cursor-default">
                                            <span class="text-xs" class:text-up=all_up class:text-down=(!all_up)>
                                                {if all_up {"▼"} else {"▶"}}
                                            </span>
                                            <span class="mono text-xs text-db-text font-medium">{node}</span>
                                        </div>
                                        <div class="pl-6">
                                            {checks.into_iter().map(|c| {
                                                let is_up = c.status == "up";
                                                view! {
                                                    <div class="flex items-center justify-between pr-3 py-0.5 hover:bg-db-dim cursor-default group">
                                                        <div class="flex items-center gap-1.5">
                                                            <span class="mono text-xs" class:text-up=is_up class:text-down=(!is_up)>
                                                                {if is_up {"●"} else {"○"}}
                                                            </span>
                                                            <span class="mono text-xs text-db-muted">{c.name}</span>
                                                        </div>
                                                        {c.response_ms.map(|ms| view! {
                                                            <span class="mono text-xs text-db-border group-hover:opacity-100 opacity-0">{ms} "ms"</span>
                                                        })}
                                                    </div>
                                                }
                                            }).collect::<Vec<_>>()}
                                        </div>
                                    </div>
                                }
                            }).collect::<Vec<_>>()}
                        </div>
                    }.into_any()
                }}
            </div>
        </div>
    }
}

// ─── MAIN EDITOR (kanban board) ───────────────────────────────────────────────

#[component]
fn Board(projects: Vec<Project>, trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let todo: Vec<_>     = projects.iter().filter(|p| p.status == "todo").cloned().collect();
    let progress: Vec<_> = projects.iter().filter(|p| p.status == "in_progress").cloned().collect();
    let done: Vec<_>     = projects.iter().filter(|p| p.status == "done").cloned().collect();

    view! {
        <div class="flex-1 grid grid-cols-3 divide-x divide-db-border overflow-hidden min-h-0">
            <BoardCol label="TODO" dot="bg-db-muted" count=todo.len()
                items=todo from="todo" to="in_progress"
                trigger=trigger modal=modal can_add=true />
            <BoardCol label="IN PROGRESS" dot="bg-amber" count=progress.len()
                items=progress from="in_progress" to="done"
                trigger=trigger modal=modal can_add=false />
            <BoardCol label="DONE" dot="bg-up" count=done.len()
                items=done from="done" to="todo"
                trigger=trigger modal=modal can_add=false />
        </div>
    }
}

#[component]
fn BoardCol(
    label: &'static str,
    dot: &'static str,
    count: usize,
    items: Vec<Project>,
    from: &'static str,
    to: &'static str,
    trigger: RwSignal<u32>,
    modal: RwSignal<Modal>,
    can_add: bool,
) -> impl IntoView {
    view! {
        <div class="flex flex-col overflow-hidden">
            <div class="panel-header">
                <div class="flex items-center gap-1.5">
                    <span class=format!("w-1.5 h-1.5 rounded-full inline-block {dot}")/>
                    <span class="font-medium">{label}</span>
                    <span class="text-db-border">{count}</span>
                </div>
                {can_add.then(|| view! {
                    <button class="mono text-sm text-db-muted hover:text-db-text cursor-pointer"
                        on:click=move |_| modal.set(Modal::AddProject)>"+"</button>
                })}
            </div>
            <div class="flex-1 overflow-y-auto py-1">
                {items.into_iter().map(|p| {
                    let id  = p.id.clone();
                    let id2 = id.clone();
                    let p2  = p.clone();
                    view! {
                        <div class="group flex items-start justify-between px-3 py-1 hover:bg-db-dim cursor-pointer"
                            on:click=move |_| modal.set(Modal::EditProject(p2.clone()))
                        >
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1.5">
                                    <span class="mono text-xs text-db-muted shrink-0">
                                        {match from { "todo" => "→", "in_progress" => "▸", _ => "✓" }}
                                    </span>
                                    <span class="mono text-xs text-db-text truncate">{p.name.clone()}</span>
                                </div>
                                {p.description.as_ref().filter(|d| !d.is_empty()).map(|d| view! {
                                    <p class="mono text-xs text-db-muted truncate pl-4">{d.clone()}</p>
                                })}
                            </div>
                            <div class="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                                {(from != "done").then(|| view! {
                                    <button class="mono text-xs text-db-muted hover:text-up cursor-pointer"
                                        on:click=move |ev| {
                                            ev.stop_propagation();
                                            let id = id.clone();
                                            leptos::task::spawn_local(async move {
                                                let body = format!(r#"{{"status":"{to}"}}"#);
                                                let _ = Request::patch(&format!("/api/projects/{id}"))
                                                    .header("Content-Type","application/json")
                                                    .body(body).unwrap().send().await;
                                                trigger.update(|n| *n += 1);
                                            });
                                        }
                                    >"→"</button>
                                })}
                                <button class="mono text-xs text-db-muted hover:text-down cursor-pointer"
                                    on:click=move |ev| {
                                        ev.stop_propagation();
                                        let id = id2.clone();
                                        leptos::task::spawn_local(async move {
                                            let _ = Request::delete(&format!("/api/projects/{id}")).send().await;
                                            trigger.update(|n| *n += 1);
                                        });
                                    }
                                >"✕"</button>
                            </div>
                        </div>
                    }
                }).collect::<Vec<_>>()}
            </div>
        </div>
    }
}

// ─── BOTTOM PANEL (VS Code terminal area) ─────────────────────────────────────

#[component]
fn BottomPanel(notes: Vec<Note>, trigger: RwSignal<u32>) -> impl IntoView {
    let input = RwSignal::new(String::new());

    let on_key = move |ev: leptos::ev::KeyboardEvent| {
        if ev.key() == "Enter" && !ev.shift_key() {
            ev.prevent_default();
            let content = input.get();
            if content.trim().is_empty() { return; }
            leptos::task::spawn_local(async move {
                let body = format!(r#"{{"content":{}}}"#, serde_json::to_string(&content).unwrap());
                let _ = Request::post("/api/notes")
                    .header("Content-Type","application/json")
                    .body(body).unwrap().send().await;
                input.set(String::new());
                trigger.update(|n| *n += 1);
            });
        }
    };

    let pinned: Vec<_>   = notes.iter().filter(|n| n.pinned == 1).cloned().collect();
    let unpinned: Vec<_> = notes.iter().filter(|n| n.pinned == 0).cloned().collect();
    let all: Vec<_>      = pinned.into_iter().chain(unpinned).collect();

    view! {
        <div class="h-44 flex-none border-t border-db-border flex bg-db-surface">
            <YoutubePanel />
            <div class="flex-1 flex flex-col overflow-hidden border-l border-db-border">
                <div class="panel-header flex-none">
                    <span>"LOG"</span>
                    <span class="text-db-border">{all.len()}</span>
                </div>
                <div class="flex items-center gap-1 px-3 py-1 border-b border-db-border flex-none">
                    <span class="mono text-xs text-db-muted shrink-0">">"</span>
                    <input
                        type="text" placeholder="entry... (↵)"
                        class="mono text-xs flex-1 bg-transparent focus:outline-none text-db-text placeholder:text-db-muted caret-db-text"
                        prop:value=move || input.get()
                        on:input=move |ev| input.set(event_target_value(&ev))
                        on:keydown=on_key
                    />
                    <span class="mono text-xs text-db-muted animate-blink">"_"</span>
                </div>
                <div class="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
                    {all.into_iter().map(|n| {
                        let id  = n.id.clone();
                        let id2 = id.clone();
                        let is_pinned = n.pinned == 1;
                        view! {
                            <div class="group flex items-start gap-1.5">
                                <button
                                    class="mono text-xs shrink-0 cursor-pointer transition-colors"
                                    class:text-amber=is_pinned
                                    class:text-db-border=(!is_pinned)
                                    on:click=move |_| {
                                        let id = id.clone();
                                        let pin = if is_pinned {0i64} else {1i64};
                                        leptos::task::spawn_local(async move {
                                            let body = format!(r#"{{"pinned":{pin}}}"#);
                                            let _ = Request::patch(&format!("/api/notes/{id}"))
                                                .header("Content-Type","application/json")
                                                .body(body).unwrap().send().await;
                                            trigger.update(|n| *n += 1);
                                        });
                                    }
                                >"★"</button>
                                <p class="mono text-xs text-db-text leading-relaxed flex-1 break-words">{n.content}</p>
                                <button
                                    class="mono text-xs text-db-border opacity-0 group-hover:opacity-100 hover:text-down cursor-pointer shrink-0"
                                    on:click=move |_| {
                                        let id = id2.clone();
                                        leptos::task::spawn_local(async move {
                                            let _ = Request::delete(&format!("/api/notes/{id}")).send().await;
                                            trigger.update(|n| *n += 1);
                                        });
                                    }
                                >"✕"</button>
                            </div>
                        }
                    }).collect::<Vec<_>>()}
                </div>
            </div>
        </div>
    }
}

// ─── MODALS ───────────────────────────────────────────────────────────────────

#[component]
fn AddModal(trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let name = RwSignal::new(String::new());
    let desc = RwSignal::new(String::new());

    let save = move || {
        let n = name.get();
        if n.trim().is_empty() { return; }
        let d = desc.get();
        leptos::task::spawn_local(async move {
            let body = format!(
                r#"{{"name":{},"description":{},"status":"todo"}}"#,
                serde_json::to_string(&n).unwrap(),
                if d.is_empty() { "null".into() } else { serde_json::to_string(&d).unwrap() },
            );
            let _ = Request::post("/api/projects").header("Content-Type","application/json")
                .body(body).unwrap().send().await;
            modal.set(Modal::None);
            trigger.update(|n| *n += 1);
        });
    };

    view! {
        <Overlay close=move || modal.set(Modal::None)>
            <p class="mono text-xs text-db-muted mb-3">"// new task"</p>
            <div class="space-y-2">
                <input type="text" placeholder="name" autofocus=true
                    class="mono text-xs w-full px-2 py-1.5 bg-db-dim border border-db-border rounded-sm text-db-text focus:outline-none focus:border-sky placeholder:text-db-muted"
                    prop:value=move || name.get()
                    on:input=move |ev| name.set(event_target_value(&ev))
                    on:keydown=move |ev| { if ev.key() == "Enter" { save(); } }
                />
                <input type="text" placeholder="description (optional)"
                    class="mono text-xs w-full px-2 py-1.5 bg-db-dim border border-db-border rounded-sm text-db-text focus:outline-none focus:border-sky placeholder:text-db-muted"
                    prop:value=move || desc.get()
                    on:input=move |ev| desc.set(event_target_value(&ev))
                />
            </div>
            <div class="flex justify-end gap-2 mt-4">
                <button class="mono text-xs px-3 py-1.5 border border-db-border rounded-sm text-db-muted hover:bg-db-dim cursor-pointer"
                    on:click=move |_| modal.set(Modal::None)>"cancel"</button>
                <button class="mono text-xs px-3 py-1.5 bg-db-text text-db-bg rounded-sm hover:opacity-80 cursor-pointer"
                    on:click=move |_| save()>"add"</button>
            </div>
        </Overlay>
    }
}

#[component]
fn EditModal(project: Project, trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let id      = project.id.clone();
    let id2     = id.clone();
    let id_key  = id.clone();
    let id_save = id.clone();
    let name = RwSignal::new(project.name.clone());
    let desc = RwSignal::new(project.description.clone().unwrap_or_default());

    let do_save = move |id: String| {
        let n = name.get();
        if n.trim().is_empty() { return; }
        let d = desc.get();
        leptos::task::spawn_local(async move {
            let body = format!(
                r#"{{"name":{},"description":{}}}"#,
                serde_json::to_string(&n).unwrap(),
                if d.is_empty() { "null".into() } else { serde_json::to_string(&d).unwrap() },
            );
            let _ = Request::patch(&format!("/api/projects/{id}"))
                .header("Content-Type","application/json").body(body).unwrap().send().await;
            modal.set(Modal::None);
            trigger.update(|n| *n += 1);
        });
    };

    view! {
        <Overlay close=move || modal.set(Modal::None)>
            <p class="mono text-xs text-db-muted mb-3">"// edit task"</p>
            <div class="space-y-2">
                <input type="text" autofocus=true
                    class="mono text-xs w-full px-2 py-1.5 bg-db-dim border border-db-border rounded-sm text-db-text focus:outline-none focus:border-sky"
                    prop:value=move || name.get()
                    on:input=move |ev| name.set(event_target_value(&ev))
                    on:keydown=move |ev| { if ev.key() == "Enter" { do_save(id_key.clone()); } }
                />
                <input type="text" placeholder="description"
                    class="mono text-xs w-full px-2 py-1.5 bg-db-dim border border-db-border rounded-sm text-db-text focus:outline-none focus:border-sky placeholder:text-db-muted"
                    prop:value=move || desc.get()
                    on:input=move |ev| desc.set(event_target_value(&ev))
                />
            </div>
            <div class="flex items-center justify-between mt-4">
                <button class="mono text-xs text-down hover:opacity-70 cursor-pointer"
                    on:click=move |_| {
                        let id = id2.clone();
                        leptos::task::spawn_local(async move {
                            let _ = Request::delete(&format!("/api/projects/{id}")).send().await;
                            modal.set(Modal::None);
                            trigger.update(|n| *n += 1);
                        });
                    }
                >"delete"</button>
                <div class="flex gap-2">
                    <button class="mono text-xs px-3 py-1.5 border border-db-border rounded-sm text-db-muted hover:bg-db-dim cursor-pointer"
                        on:click=move |_| modal.set(Modal::None)>"cancel"</button>
                    <button class="mono text-xs px-3 py-1.5 bg-db-text text-db-bg rounded-sm hover:opacity-80 cursor-pointer"
                        on:click=move |_| do_save(id_save.clone())>"save"</button>
                </div>
            </div>
        </Overlay>
    }
}

#[component]
fn Overlay(close: impl Fn() + 'static, children: Children) -> impl IntoView {
    view! {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center animate-fade-in"
            on:click=move |_| close()
        >
            <div class="bg-db-surface border border-db-border rounded-sm p-5 w-full max-w-sm shadow-2xl"
                on:click=move |ev| ev.stop_propagation()
            >
                {children()}
            </div>
        </div>
    }
}
