import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'


function App() {
    return(
        <>
            <BrowserRouter>
                <Routes> 
                    <Route path="/" element={<LandingPage />} />
                    {/* Add more routes as needed */}
                </Routes>
            </BrowserRouter>
        </>
    );
}

export default App;