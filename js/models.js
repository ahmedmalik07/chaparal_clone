// Models page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('open');
        });
    }

    // Cookie notice
    const cookieNotice = document.getElementById('cookie-notice');
    const cookieAccept = document.getElementById('cookie-accept');
    
    if (cookieAccept) {
        cookieAccept.addEventListener('click', function() {
            cookieNotice.classList.add('hidden');
            localStorage.setItem('cookieAccepted', 'true');
        });
    }

    if (localStorage.getItem('cookieAccepted') === 'true') {
        cookieNotice.classList.add('hidden');
    }

    // Smooth scroll header
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.site-header');
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.3)';
        } else {
            header.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
});
