//NAVBAR POPUP
const menuBtn = document.querySelector('.menuBtn')
const nav = document.querySelector('.nav-links')
menuBtn.addEventListener('click' , ()=>{
    nav.classList.toggle('shown')
})
//SLIDER

const pages = document.querySelectorAll('.page')
const nextBtn = document.querySelector('.next')
const prevBtn = document.querySelector('.prev')
let count = 0;

nextBtn.addEventListener('click', ()=>{
    if(count === 2){
        pages.forEach(a =>{
            a.style.transform = `translateX(0%)`
        })
        count = 0
    }
    else{
    count++
    pages.forEach(a =>{
        a.style.transform = `translateX(-${100 * count}%)`
    })
}
})
prevBtn.addEventListener('click', ()=>{
    if(count === 0){
        pages.forEach(a =>{
            a.style.transform = `translateX(-200%)`
        })
        count = 2
    }
    else{
    count--
    pages.forEach(a =>{
        a.style.transform = `translateX(-${100 * count}%)`
    })
}
})