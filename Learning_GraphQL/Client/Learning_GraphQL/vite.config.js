// // import { defineConfig } from 'vite'
// // import react from '@vitejs/plugin-react'

// // // https://vite.dev/config/
// // export default defineConfig({
// //   plugins: [react()],
// // })

// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     include: ['react', 'react-dom', '@apollo/client', '@apollo/client/react'],
//   },
// })

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'], // ✅ forces single copy of React
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@apollo/client', '@apollo/client/react'],
  },
})