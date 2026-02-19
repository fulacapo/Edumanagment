/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx"
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    green: '#2E5C44', // Deeper, more forest green for premium feel
                    gold: '#C5A065',  // Muted gold for accents
                    dark: '#1F2937',
                    light: '#F9FAFB', // Paper-like background
                    red: '#EF4444',
                    soft_green: '#D1FAE5',
                    soft_red: '#FEE2E2',
                }
            },
            fontFamily: {
                serif: ['Playfair Display', 'serif'],
                sans: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            }
        },
    },
    plugins: [],
}
