import { List, ListItem, ListItemButton, Typography } from '@mui/joy';

export function Sidebar({
activeTab,
setActiveTab,
}: {
activeTab: string;
setActiveTab: (tab: string) => void;
}) {
return (
    <div className="sidebar">
    <List>
        <ListItem>
        <ListItemButton
            selected={activeTab === 'Integrations'}
            onClick={() => setActiveTab('Integrations')}
        >
            <Typography className="sidebar-item">Integrations</Typography>
        </ListItemButton>
        </ListItem>
        <ListItem>
        <ListItemButton
            selected={activeTab === 'FastFlags'}
            onClick={() => setActiveTab('FastFlags')}
        >
            <Typography className="sidebar-item">Fast Flags</Typography>
        </ListItemButton>
        </ListItem>
        <ListItem>
        <ListItemButton
            selected={activeTab === 'Mods'}
            onClick={() => setActiveTab('Mods')}
        >
            <Typography className="sidebar-item">Mods</Typography>
        </ListItemButton>
        </ListItem>

    </List>

    <div className="sidebar-bottom">
        <List sx={{ p: 0 }}>
        <ListItem>
        <ListItemButton
            selected={activeTab === 'Appearance'}
            onClick={() => setActiveTab('Appearance')}
        >
            <Typography className="sidebar-item">Appearance</Typography>
        </ListItemButton>
        </ListItem>
        <ListItem>
            <ListItemButton
            selected={activeTab === 'About'}
            onClick={() => setActiveTab('About')}
            >
            <Typography className="sidebar-item">About</Typography>
            </ListItemButton>
        </ListItem>
        </List>
    </div>
    </div>
);
}
