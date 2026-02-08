import { Typography, Divider, Card, AspectRatio, Box, Stack, Link, Chip } from '@mui/joy';

export default function About() {
    return (
        <Box sx={{ pb: 4 }}>
            <Divider className="content-divider" />
            
            <Typography className="content-text" sx={{ mb: 4, mt: 2 }}>
                nullstrap is a cross-platform Roblox bootstrapper built with Tauri, designed to provide a seamless experience for launching Roblox on various platforms ranging from Windows, to Linux, to MacOS, and more.
            </Typography>
            <Divider className="content-divider" />
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>Developers</Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Card variant="outlined" orientation="horizontal" sx={{ bgcolor: 'transparent', borderColor: 'var(--border-color)', gap: 2, alignItems: 'center', '&:hover': { borderColor: 'var(--text-primary)' }, transition: 'all 0.2s', pr: 4 }}>
                     <AspectRatio ratio="1" sx={{ width: 50, borderRadius: '50%' }}>
                        <img src="https://github.com/wakefulblock262.png" alt="wakefulblock262" />
                    </AspectRatio>
                    <Box>
                        <Link href="https://github.com/wakefulblock262" target="_blank" overlay underline="none">
                            <Typography level="title-lg" sx={{ color: 'var(--text-primary)' }}>wakefulblock262</Typography>
                        </Link>
                        <Typography level="body-sm" sx={{ color: 'var(--text-primary)', opacity: 0.7 }}>Lead Developer</Typography>
                    </Box>
                </Card>
            </Stack>
            <Divider className="content-divider" />
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>Inspirations & Credits</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 4 }}>
                {['Voidstrap', 'Plexity', 'Bloxstrap', 'Froststrap', 'Fishstrap'].map(name => (
                    <Chip 
                        key={name} 
                        variant="outlined" 
                        size="lg" 
                        sx={{ 
                            bgcolor: 'transparent',
                            borderColor: 'var(--border-color)', 
                            color: 'var(--text-primary)',
                            '&:hover': {
                                bgcolor: 'var(--select-bg-hover)',
                                borderColor: 'var(--text-primary)'
                            }
                        }}
                    >
                        {name}
                    </Chip>
                ))}
            </Stack>
            <Divider className="content-divider" />
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>Licenses</Typography>
            <Typography level="body-md" sx={{ color: 'var(--text-primary)', mb: 1 }}>
                This project is licensed under the MIT License.
            </Typography>
             <Card variant="outlined" sx={{ bgcolor: 'transparent', borderColor: 'var(--border-color)', p: 2, maxHeight: '200px', overflow: 'auto' }}>
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: 'var(--text-primary)', opacity: 0.8, whiteSpace: 'pre-wrap' }}>
{`Dependencies:
- @tauri-apps/api: Apache-2.0 or MIT
- @tauri-apps/plugin-fs: Apache-2.0 or MIT
- @tauri-apps/plugin-http: Apache-2.0 or MIT
- @tauri-apps/plugin-opener: Apache-2.0 or MIT
- @tauri-apps/plugin-os: Apache-2.0 or MIT
- @tauri-apps/plugin-shell: Apache-2.0 or MIT
- fflate: MIT
- @tauri-apps/cli (dev): Apache-2.0 or MIT
- typescript (dev): Apache-2.0
- vite (dev): MIT`}
                </Typography>
            </Card>
        </Box>
    );
}
