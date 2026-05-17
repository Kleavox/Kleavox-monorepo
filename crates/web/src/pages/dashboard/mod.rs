// crates/web/src/pages/dashboard/mod.rs

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
enum Modal {
    AddProject,
    EditProject(Project),
    None,
}

#[component]
pub fn Dashboard() -> impl IntoView {
    let trigger = RwSignal::new(0u32);
    let modal = RwSignal::new(Modal::None);

    let data = LocalResource::new(move || {
        trigger.get();
        async { fetch_all().await }
    });

    view! {
        <div class="flex-1 min-h-0 grid grid-cols-[220px_1fr_220px] divide-x divide-db-border overflow-hidden">
            {move || match data.read().as_deref() {
                None => view! {
                    <div class="col-span-3 flex items-center justify-center">
                        <span class="mono text-xs text-db-muted animate-pulse-dot">"loading..."</span>
                    </div>
                }.into_any(),
                Some((uptime, projects, notes)) => view! {
                    <ServersPanel checks=uptime.clone() />
                    <ProjectsPanel projects=projects.clone() trigger=trigger modal=modal />
                    <NotesPanel notes=notes.clone() trigger=trigger />
                }.into_any(),
            }}
        </div>

        {move || match modal.get() {
            Modal::None => view! { <div/> }.into_any(),
            Modal::AddProject => view! {
                <AddProjectModal trigger=trigger modal=modal />
            }.into_any(),
            Modal::EditProject(p) => view! {
                <EditProjectModal project=p trigger=trigger modal=modal />
            }.into_any(),
        }}
    }
}

#[component]
fn ServersPanel(checks: Vec<UptimeCheck>) -> impl IntoView {
    let mut grouped: Vec<(String, Vec<UptimeCheck>)> = vec![];
    for check in checks {
        if let Some(g) = grouped.iter_mut().find(|(n, _)| n == &check.node_name) {
            g.1.push(check);
        } else {
            grouped.push((check.node_name.clone(), vec![check]));
        }
    }

    view! {
        <div class="overflow-y-auto p-3 flex flex-col gap-3">
            <p class="mono text-xs text-db-muted uppercase tracking-widest">"SERVERS"</p>
            {if grouped.is_empty() {
                view! {
                    <p class="mono text-xs text-db-muted leading-relaxed">
                        "No agents." <br/> "curl board.deau.site/install.sh | sh"
                    </p>
                }.into_any()
            } else {
                view! {
                    <div class="space-y-3">
                        {grouped.into_iter().map(|(node, checks)| {
                            let all_up = checks.iter().all(|c| c.status == "up");
                            view! {
                                <div>
                                    <p class="mono text-xs font-medium mb-1"
                                        class:text-up=all_up
                                        class:text-db-muted=(!all_up)
                                    >
                                        {if all_up {"●"} else {"○"}} " " {node}
                                    </p>
                                    <div class="space-y-px pl-2 border-l border-db-border">
                                        {checks.into_iter().map(|c| {
                                            let is_up = c.status == "up";
                                            view! {
                                                <div class="flex items-center justify-between gap-1">
                                                    <span class="mono text-xs text-db-muted truncate">{c.name}</span>
                                                    <div class="flex items-center gap-1 shrink-0">
                                                        {c.response_ms.map(|ms| view! {
                                                            <span class="mono text-xs text-db-border">{ms} "ms"</span>
                                                        })}
                                                        <span class="mono text-xs"
                                                            class:text-up=is_up
                                                            class:text-down=(!is_up)
                                                        >{if is_up {"✓"} else {"✗"}}</span>
                                                    </div>
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
    }
}

#[component]
fn ProjectsPanel(projects: Vec<Project>, trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let todo: Vec<_> = projects.iter().filter(|p| p.status == "todo").cloned().collect();
    let progress: Vec<_> = projects.iter().filter(|p| p.status == "in_progress").cloned().collect();
    let done: Vec<_> = projects.iter().filter(|p| p.status == "done").cloned().collect();

    view! {
        <div class="grid grid-cols-3 divide-x divide-db-border overflow-hidden min-h-0">
            <ProjectColumn label="TODO" label_class="text-db-muted"
                projects=todo from="todo" to="in_progress" trigger=trigger modal=modal show_add=true />
            <ProjectColumn label="IN PROGRESS" label_class="text-amber-600"
                projects=progress from="in_progress" to="done" trigger=trigger modal=modal show_add=false />
            <ProjectColumn label="DONE" label_class="text-up"
                projects=done from="done" to="todo" trigger=trigger modal=modal show_add=false />
        </div>
    }
}

#[component]
fn ProjectColumn(
    label: &'static str,
    label_class: &'static str,
    projects: Vec<Project>,
    from: &'static str,
    to: &'static str,
    trigger: RwSignal<u32>,
    modal: RwSignal<Modal>,
    show_add: bool,
) -> impl IntoView {
    view! {
        <div class="overflow-y-auto p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between mb-1">
                <p class=format!("mono text-xs font-medium uppercase tracking-widest {label_class}")>
                    {label}
                </p>
                {show_add.then(|| view! {
                    <button
                        class="mono text-xs text-db-muted hover:text-db-text cursor-pointer"
                        on:click=move |_| modal.set(Modal::AddProject)
                    >"+"</button>
                })}
            </div>

            {projects.into_iter().map(|p| {
                let id = p.id.clone();
                let id2 = id.clone();
                let p2 = p.clone();
                view! {
                    <div class="group flex items-start gap-1 py-1 border-b border-db-border last:border-0">
                        <div class="flex-1 min-w-0 cursor-pointer"
                            on:click=move |_| modal.set(Modal::EditProject(p2.clone()))
                        >
                            <p class="mono text-xs text-db-text">{p.name.clone()}</p>
                            {p.description.as_ref().filter(|d| !d.is_empty()).map(|d| view! {
                                <p class="mono text-xs text-db-muted truncate">{d.clone()}</p>
                            })}
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                            {(from != "done").then(|| view! {
                                <button class="mono text-xs text-db-muted hover:text-up cursor-pointer"
                                    on:click=move |_| {
                                        let id = id.clone();
                                        leptos::task::spawn_local(async move {
                                            let body = format!(r#"{{"status":"{to}"}}"#);
                                            let _ = Request::patch(&format!("/api/projects/{id}"))
                                                .header("Content-Type", "application/json")
                                                .body(body).unwrap().send().await;
                                            trigger.update(|n| *n += 1);
                                        });
                                    }
                                >"→"</button>
                            })}
                            <button class="mono text-xs text-db-muted hover:text-down cursor-pointer"
                                on:click=move |_| {
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
    }
}

#[component]
fn NotesPanel(notes: Vec<Note>, trigger: RwSignal<u32>) -> impl IntoView {
    let input = RwSignal::new(String::new());

    let on_keydown = move |ev: leptos::ev::KeyboardEvent| {
        if ev.key() == "Enter" && !ev.shift_key() {
            ev.prevent_default();
            let content = input.get();
            if content.trim().is_empty() { return; }
            leptos::task::spawn_local(async move {
                let body = format!(r#"{{"content":{}}}"#, serde_json::to_string(&content).unwrap());
                let _ = Request::post("/api/notes")
                    .header("Content-Type", "application/json")
                    .body(body).unwrap().send().await;
                input.set(String::new());
                trigger.update(|n| *n += 1);
            });
        }
    };

    let pinned: Vec<_> = notes.iter().filter(|n| n.pinned == 1).cloned().collect();
    let unpinned: Vec<_> = notes.iter().filter(|n| n.pinned == 0).cloned().collect();
    let all: Vec<_> = pinned.into_iter().chain(unpinned).collect();

    view! {
        <div class="overflow-y-auto p-3 flex flex-col gap-2">
            <p class="mono text-xs text-db-muted uppercase tracking-widest">"NOTES"</p>
            <input
                type="text" placeholder="note... (Enter)"
                class="mono text-xs w-full bg-transparent border-0 border-b border-db-border pb-1 focus:outline-none focus:border-db-text text-db-text placeholder:text-db-border transition-colors"
                prop:value=move || input.get()
                on:input=move |ev| input.set(event_target_value(&ev))
                on:keydown=on_keydown
            />
            <div class="space-y-1 mt-0.5">
                {all.into_iter().map(|n| {
                    let id = n.id.clone();
                    let id2 = id.clone();
                    let is_pinned = n.pinned == 1;
                    view! {
                        <div class="group flex items-start gap-1.5">
                            <button
                                class="mono text-xs shrink-0 cursor-pointer"
                                class:text-db-text=is_pinned
                                class:text-db-border=(!is_pinned)
                                on:click=move |_| {
                                    let id = id.clone();
                                    let new_pin = if is_pinned {0i64} else {1i64};
                                    leptos::task::spawn_local(async move {
                                        let body = format!(r#"{{"pinned":{new_pin}}}"#);
                                        let _ = Request::patch(&format!("/api/notes/{id}"))
                                            .header("Content-Type", "application/json")
                                            .body(body).unwrap().send().await;
                                        trigger.update(|n| *n += 1);
                                    });
                                }
                            >"★"</button>
                            <p class="mono text-xs text-db-muted leading-relaxed flex-1 break-words">{n.content}</p>
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
    }
}

#[component]
fn AddProjectModal(trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let name = RwSignal::new(String::new());
    let desc = RwSignal::new(String::new());

    view! {
        <ModalOverlay on_close=move || modal.set(Modal::None)>
            <p class="mono text-xs font-medium text-db-text mb-4">"ADD PROJECT"</p>
            <div class="space-y-2">
                <input type="text" placeholder="Task name" autofocus=true
                    class="mono text-xs w-full px-2 py-1.5 border border-db-border rounded-sm bg-db-bg focus:outline-none focus:border-db-text"
                    prop:value=move || name.get()
                    on:input=move |ev| name.set(event_target_value(&ev))
                    on:keydown=move |ev| {
                        if ev.key() == "Enter" {
                            let n = name.get();
                            if n.trim().is_empty() { return; }
                            let d = desc.get();
                            leptos::task::spawn_local(async move {
                                let body = format!(
                                    r#"{{"name":{},"description":{},"status":"todo"}}"#,
                                    serde_json::to_string(&n).unwrap(),
                                    if d.is_empty() { "null".into() } else { serde_json::to_string(&d).unwrap() },
                                );
                                let _ = Request::post("/api/projects")
                                    .header("Content-Type", "application/json")
                                    .body(body).unwrap().send().await;
                                modal.set(Modal::None);
                                trigger.update(|n| *n += 1);
                            });
                        }
                    }
                />
                <input type="text" placeholder="Description (optional)"
                    class="mono text-xs w-full px-2 py-1.5 border border-db-border rounded-sm bg-db-bg focus:outline-none focus:border-db-text"
                    prop:value=move || desc.get()
                    on:input=move |ev| desc.set(event_target_value(&ev))
                />
            </div>
            <div class="flex gap-2 mt-4 justify-end">
                <button
                    class="mono text-xs px-3 py-1.5 border border-db-border rounded-sm hover:bg-db-subtle cursor-pointer text-db-muted"
                    on:click=move |_| modal.set(Modal::None)
                >"cancel"</button>
                <button
                    class="mono text-xs px-3 py-1.5 bg-db-text text-db-surface rounded-sm hover:opacity-80 cursor-pointer"
                    on:click=move |_| {
                        let n = name.get();
                        if n.trim().is_empty() { return; }
                        let d = desc.get();
                        leptos::task::spawn_local(async move {
                            let body = format!(
                                r#"{{"name":{},"description":{},"status":"todo"}}"#,
                                serde_json::to_string(&n).unwrap(),
                                if d.is_empty() { "null".into() } else { serde_json::to_string(&d).unwrap() },
                            );
                            let _ = Request::post("/api/projects")
                                .header("Content-Type", "application/json")
                                .body(body).unwrap().send().await;
                            modal.set(Modal::None);
                            trigger.update(|n| *n += 1);
                        });
                    }
                >"add"</button>
            </div>
        </ModalOverlay>
    }
}

#[component]
fn EditProjectModal(project: Project, trigger: RwSignal<u32>, modal: RwSignal<Modal>) -> impl IntoView {
    let id = project.id.clone();
    let id2 = id.clone();
    let name = RwSignal::new(project.name.clone());
    let desc = RwSignal::new(project.description.clone().unwrap_or_default());

    view! {
        <ModalOverlay on_close=move || modal.set(Modal::None)>
            <p class="mono text-xs font-medium text-db-text mb-4">"EDIT PROJECT"</p>
            <div class="space-y-2">
                <input type="text" autofocus=true
                    class="mono text-xs w-full px-2 py-1.5 border border-db-border rounded-sm bg-db-bg focus:outline-none focus:border-db-text"
                    prop:value=move || name.get()
                    on:input=move |ev| name.set(event_target_value(&ev))
                />
                <input type="text" placeholder="Description"
                    class="mono text-xs w-full px-2 py-1.5 border border-db-border rounded-sm bg-db-bg focus:outline-none focus:border-db-text"
                    prop:value=move || desc.get()
                    on:input=move |ev| desc.set(event_target_value(&ev))
                />
            </div>
            <div class="flex items-center justify-between mt-4">
                <button
                    class="mono text-xs text-down hover:opacity-70 cursor-pointer"
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
                    <button
                        class="mono text-xs px-3 py-1.5 border border-db-border rounded-sm hover:bg-db-subtle cursor-pointer text-db-muted"
                        on:click=move |_| modal.set(Modal::None)
                    >"cancel"</button>
                    <button
                        class="mono text-xs px-3 py-1.5 bg-db-text text-db-surface rounded-sm hover:opacity-80 cursor-pointer"
                        on:click=move |_| {
                            let id = id.clone();
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
                                    .header("Content-Type", "application/json")
                                    .body(body).unwrap().send().await;
                                modal.set(Modal::None);
                                trigger.update(|n| *n += 1);
                            });
                        }
                    >"save"</button>
                </div>
            </div>
        </ModalOverlay>
    }
}

#[component]
fn ModalOverlay(on_close: impl Fn() + 'static, children: Children) -> impl IntoView {
    view! {
        <div class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
            on:click=move |_| on_close()
        >
            <div class="bg-db-surface border border-db-border rounded-sm p-5 w-full max-w-sm shadow-sm"
                on:click=move |ev| ev.stop_propagation()
            >
                {children()}
            </div>
        </div>
    }
}
