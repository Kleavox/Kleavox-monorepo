use leptos::*;

mod pages;
mod components;

fn main() {
    mount_to_body(App);
}

#[component]
fn App() -> impl IntoView {
    view! {
        <div class="app">
            <h1>"Deauboard"</h1>
            <pages::Dashboard />
        </div>
    }
}
