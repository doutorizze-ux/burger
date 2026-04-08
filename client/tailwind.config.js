/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "rgb(var(--primary-rgb) / <alpha-value>)",
                secondary: "#1e293b",
            }
        },
    },
    plugins: [],
}
