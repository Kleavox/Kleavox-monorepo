use deauboard_shared::{Project, UptimeCheck};
use gloo_net::http::Request;
use leptos::prelude::*;
use std::rc::Rc;

async fn fetch_projects() -> Result<Vec<Project>, String> {
    Request::get("/api/projects")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<Project>>()
        .await
        .map_err(|e| e.to_string())
}

#[component]
pub fn Dashboard() -> impl IntoView {
    let trigger = RwSignal::new(0u32);
    let refresh = move || trigger.update(|n| *n += 1);

    let projects = LocalResource::new(move || {
        trigger.get();
        fetch_projects()
    });

    view! {
        <section>
            <div class="flex items-center gap-2 mb-5">
                <h2 class="text-xs font-semibold text-db-muted uppercase tracking-widest">"Projects"</h2>
                {move || {
                    if let Some(Ok(list)) = projects.read().as_deref() {
                        let count = list.len();
                        Some(view! {
                            <span class="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">
                                {count}
                            </span>
                        })
                    } else {
                        None
                    }
                }}
            </div>

            <CreateProjectForm refresh=refresh />

            {move || match projects.read().as_deref() {
                None => view! {
                    <div class="space-y-2 mt-4">
                        <div class="h-16 bg-stone-100 rounded-xl animate-pulse-slow"/>
                        <div class="h-16 bg-stone-100 rounded-xl animate-pulse-slow" style="animation-delay: 0.1s"/>
                        <div class="h-16 bg-stone-100 rounded-xl animate-pulse-slow" style="animation-delay: 0.2s"/>
                    </div>
                }.into_any(),
                Some(Err(e)) => view! {
                    <div class="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                        "Gagal memuat: " {e.clone()}
                    </div>
                }.into_any(),
                Some(Ok(list)) if list.is_empty() => view! {
                    <div class="mt-4 py-12 flex flex-col items-center gap-2 border border-dashed border-db-border rounded-xl">
                        <span class="text-2xl">"📋"</span>
                        <p class="text-sm text-db-muted">"Belum ada project. Tambahkan di atas!"</p>
                    </div>
                }.into_any(),
                Some(Ok(list)) => {
                    let list = list.clone();
                    view! {
                        <ul class="mt-4 space-y-2">
                            {list.into_iter().enumerate().map(|(i, p)| {
                                let delay = format!("animation-delay: {}ms", i * 50);
                                view! {
                                    <li style=delay class="animate-fade-up opacity-0">
                                        <ProjectCard project=p refresh=refresh />
                                    </li>
                                }
                            }).collect::<Vec<_>>()}
                        </ul>
                    }.into_any()
                }
            }}
        </section>

        <div class="mt-10">
            <UptimeSection />
        </div>
    }
}

// ─── Uptime Section ──────────────────────────────────────────────────────────

async fn fetch_uptime() -> Result<Vec<UptimeCheck>, String> {
    Request::get("/api/uptime")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<UptimeCheck>>()
        .await
        .map_err(|e| e.to_string())
}

#[component]
fn UptimeSection() -> impl IntoView {
    let trigger = RwSignal::new(0u32);
    let checks = LocalResource::new(move || {
        trigger.get();
        fetch_uptime()
    });

    view! {
        <div>
            <div class="flex items-center gap-2 mb-5">
                <h2 class="text-xs font-semibold text-db-muted uppercase tracking-widest">"Uptime"</h2>
                {move || {
                    if let Some(Ok(list)) = checks.read().as_deref() {
                        let up = list.iter().filter(|c| c.status == "up").count();
                        let total = list.len();
                        if total > 0 {
                            let color = if up == total { "bg-emerald-100 text-emerald-700" } else { "bg-red-100 text-red-700" };
                            Some(view! {
                                <span class=format!("text-xs px-2 py-0.5 rounded-full font-medium {color}")>
                                    {up} "/" {total} " up"
                                </span>
                            })
                        } else { None }
                    } else { None }
                }}
            </div>

            {move || match checks.read().as_deref() {
                None => view! {
                    <div class="space-y-2">
                        <div class="h-14 bg-stone-100 rounded-xl animate-pulse-slow"/>
                        <div class="h-14 bg-stone-100 rounded-xl animate-pulse-slow" style="animation-delay:0.1s"/>
                    </div>
                }.into_any(),
                Some(Err(e)) => view! {
                    <p class="text-sm text-red-500">"Gagal memuat: " {e.clone()}</p>
                }.into_any(),
                Some(Ok(list)) if list.is_empty() => view! {
                    <div class="py-10 flex flex-col items-center gap-2 border border-dashed border-db-border rounded-xl">
                        <span class="text-2xl">"📡"</span>
                        <p class="text-sm text-db-muted">"Belum ada service yang dipantau"</p>
                        <p class="text-xs text-db-muted">"Install agent di VPS untuk mulai monitoring"</p>
                    </div>
                }.into_any(),
                Some(Ok(list)) => {
                    // Kelompokkan per node
                    let mut grouped: Vec<(String, Vec<UptimeCheck>)> = vec![];
                    for check in list.clone() {
                        if let Some(group) = grouped.iter_mut().find(|(n, _)| n == &check.node_name) {
                            group.1.push(check);
                        } else {
                            grouped.push((check.node_name.clone(), vec![check]));
                        }
                    }
                    view! {
                        <div class="space-y-4">
                            {grouped.into_iter().map(|(node, node_checks)| {
                                let all_up = node_checks.iter().all(|c| c.status == "up");
                                let node_color = if all_up { "text-emerald-600" } else { "text-red-500" };
                                view! {
                                    <div>
                                        <p class=format!("text-xs font-medium mb-2 {node_color}")>
                                            "● " {node}
                                        </p>
                                        <ul class="space-y-1.5">
                                            {node_checks.into_iter().map(|c| {
                                                let id = c.id.clone();
                                                let refresh = move || trigger.update(|n| *n += 1);
                                                view! {
                                                    <UptimeRow check=c on_delete=move || {
                                                        let id = id.clone();
                                                        let refresh = refresh.clone();
                                                        leptos::task::spawn_local(async move {
                                                            let _ = Request::delete(&format!("/api/uptime/{id}")).send().await;
                                                            refresh();
                                                        });
                                                    }/>
                                                }
                                            }).collect::<Vec<_>>()}
                                        </ul>
                                    </div>
                                }
                            }).collect::<Vec<_>>()}
                        </div>
                    }.into_any()
                }
            }}
        </div>
    }
}

#[component]
fn UptimeRow(check: UptimeCheck, on_delete: impl Fn() + 'static) -> impl IntoView {
    let (dot_class, status_text) = match check.status.as_str() {
        "up"   => ("bg-emerald-500 animate-pulse-slow", "Up"),
        "down" => ("bg-red-500 animate-pulse-slow",     "Down"),
        _      => ("bg-stone-300",                      "Unknown"),
    };

    view! {
        <li class="group flex items-center gap-3 px-4 py-3 bg-white border border-db-border rounded-xl hover:shadow-sm transition-all duration-150">
            <span class=format!("w-2 h-2 rounded-full shrink-0 {dot_class}")/>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-db-text truncate">{check.name}</p>
                <p class="text-xs text-db-muted truncate">{check.url}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                {check.response_ms.map(|ms| view! {
                    <span class="text-xs text-db-muted hidden sm:block">{ms} "ms"</span>
                })}
                <span class=format!(
                    "text-xs font-medium {}",
                    if check.status == "up" { "text-emerald-600" } else if check.status == "down" { "text-red-500" } else { "text-stone-400" }
                )>{status_text}</span>
                <button
                    class="opacity-0 group-hover:opacity-100 text-db-muted hover:text-red-500 transition-all duration-150 p-1 rounded hover:bg-red-50 cursor-pointer"
                    on:click=move |_| on_delete()
                    title="Hapus"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </li>
    }
}

// ─── Projects Section ─────────────────────────────────────────────────────────

#[component]
fn ProjectCard(project: Project, refresh: impl Fn() + Clone + 'static) -> impl IntoView {
    let id = project.id.clone();
    let id_del = id.clone();
    let refresh_patch = refresh.clone();
    let refresh_del = refresh.clone();

    let (left_border, badge_class, next_status, status_label) = match project.status.as_str() {
        "todo"        => ("border-l-stone-200",  "bg-stone-100 text-stone-600 hover:bg-stone-200",                              "in_progress", "Todo"),
        "in_progress" => ("border-l-amber-400",  "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",       "done",        "In Progress"),
        _             => ("border-l-emerald-500", "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100", "todo",       "Done"),
    };

    let on_status = move |_| {
        let id = id.clone();
        let next = next_status.to_string();
        let refresh = refresh_patch.clone();
        leptos::task::spawn_local(async move {
            let body = format!(r#"{{"status":"{next}"}}"#);
            let _ = Request::patch(&format!("/api/projects/{id}"))
                .header("Content-Type", "application/json")
                .body(body).unwrap()
                .send().await;
            refresh();
        });
    };

    let on_delete = move |_| {
        let id = id_del.clone();
        let refresh = refresh_del.clone();
        leptos::task::spawn_local(async move {
            let _ = Request::delete(&format!("/api/projects/{id}"))
                .send().await;
            refresh();
        });
    };

    view! {
        <div class=format!(
            "group flex items-center gap-4 p-4 bg-white border border-db-border border-l-4 {} rounded-xl shadow-sm hover:shadow-md transition-all duration-150",
            left_border
        )>
            <div class="min-w-0 flex-1">
                <p class="font-medium text-db-text text-sm truncate">{project.name}</p>
                {project.description.filter(|d| !d.is_empty()).map(|d| view! {
                    <p class="text-xs text-db-muted truncate mt-0.5">{d}</p>
                })}
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button
                    class=format!("text-xs font-medium px-2.5 py-1 rounded-full transition-colors duration-150 cursor-pointer {badge_class}")
                    on:click=on_status
                >
                    {status_label}
                </button>
                <button
                    class="opacity-0 group-hover:opacity-100 text-db-muted hover:text-red-500 transition-all duration-150 p-1 rounded hover:bg-red-50 cursor-pointer"
                    on:click=on_delete
                    title="Hapus"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>
    }
}

#[component]
fn CreateProjectForm(refresh: impl Fn() + 'static) -> impl IntoView {
    let refresh = Rc::new(refresh);
    let name = RwSignal::new(String::new());
    let desc = RwSignal::new(String::new());
    let loading = RwSignal::new(false);

    let on_submit = {
        let refresh = Rc::clone(&refresh);
        move |ev: leptos::ev::SubmitEvent| {
            ev.prevent_default();
            let n = name.get();
            if n.trim().is_empty() { return; }
            let d = desc.get();
            let refresh = Rc::clone(&refresh);
            loading.set(true);
            leptos::task::spawn_local(async move {
                let body = format!(
                    r#"{{"name":{name},"description":{desc},"status":"todo"}}"#,
                    name = serde_json::to_string(&n).unwrap(),
                    desc = if d.is_empty() { "null".into() } else { serde_json::to_string(&d).unwrap() },
                );
                let _ = Request::post("/api/projects")
                    .header("Content-Type", "application/json")
                    .body(body).unwrap()
                    .send().await;
                name.set(String::new());
                desc.set(String::new());
                loading.set(false);
                refresh();
            });
        }
    };

    view! {
        <form on:submit=on_submit class="flex gap-2">
            <input
                type="text"
                placeholder="Nama project"
                class="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-db-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-150 placeholder:text-db-muted"
                prop:value=move || name.get()
                on:input=move |ev| name.set(event_target_value(&ev))
            />
            <input
                type="text"
                placeholder="Deskripsi"
                class="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-db-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-150 placeholder:text-db-muted hidden sm:block"
                prop:value=move || desc.get()
                on:input=move |ev| desc.set(event_target_value(&ev))
            />
            <button
                type="submit"
                class="px-4 py-2 text-sm font-medium bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 shrink-0"
                prop:disabled=move || loading.get()
            >
                {move || if loading.get() { "..." } else { "Tambah" }}
            </button>
        </form>
    }
}
