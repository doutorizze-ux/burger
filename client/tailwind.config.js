import colors from "tailwindcss/colors";

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
                secondary: "#000000",
                orange: colors.yellow,
            }
        },
    },
    plugins: [],
}
