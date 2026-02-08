
import { Typography, Box } from '@mui/joy';

export default function Integrations() {
    return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', opacity: 0.5 }}>
             <Typography level="body-md">No integrations available.</Typography>
        </Box>
    );
}

