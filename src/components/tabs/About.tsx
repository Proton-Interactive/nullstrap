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
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>Project License</Typography>
            <Typography level="body-md" sx={{ color: 'var(--text-primary)', mb: 2 }}>
                This project is licensed under the <Link href="https://opensource.org/licenses/MIT" target="_blank" sx={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>MIT License</Link>.
            </Typography>

            <Divider className="content-divider" />
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>External Projects</Typography>
            <Stack spacing={2} sx={{ mb: 4 }}>
                <Typography level="body-sm" sx={{ color: 'var(--text-primary)', opacity: 0.7, mb: 0.5 }}>
                    nullstrap is powered by several projects. Click any project to visit its website.
                </Typography>
                
                {[
                    { name: 'Sober', website: 'https://sober.vinegarhq.org/', license: 'GPLv3', desc: 'A standalone Roblox runtime for Linux, providing a high-performance environment.' },
                    { name: 'Vinegar', website: 'https://vinegarhq.org/', license: 'GPLv3', desc: 'The primary tool for running Roblox Studio on Linux, focusing on stability and compatibility.' },
                    { name: 'Flatpak', website: 'https://flatpak.org/', license: 'LGPL', desc: 'A system for building, distributing, and running sandboxed desktop applications on Linux.' },
                    { name: 'Tauri', website: 'https://tauri.app/', license: 'MIT/Apache-2.0', desc: 'The framework used to build this application, enabling cross-platform desktop apps with web tech.' }
                ].map((item) => (
                    <Card 
                        key={item.name}
                        variant="outlined" 
                        sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.02)', 
                            borderColor: 'var(--border-color)', 
                            p: 2,
                            position: 'relative',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': { 
                                bgcolor: 'var(--select-bg-hover)', 
                                borderColor: 'var(--text-primary)',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }
                        }}
                    >
                        <Link href={item.website} target="_blank" overlay underline="none" sx={{ color: 'inherit' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                                        <Typography level="title-lg" sx={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.name}</Typography>
                                        <Chip size="sm" variant="soft" color="primary" sx={{ borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>{item.license}</Chip>
                                    </Stack>
                                    <Typography level="body-sm" sx={{ color: 'var(--text-primary)', opacity: 0.7 }}>{item.desc}</Typography>
                                </Box>
                            </Stack>
                        </Link>
                    </Card>
                ))}
            </Stack>

            <Divider className="content-divider" />
            <Typography className="option-header" level="body-md" sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}>Internal Dependencies</Typography>
             <Card variant="outlined" sx={{ bgcolor: 'transparent', borderColor: 'var(--border-color)', p: 2, maxHeight: '180px', overflow: 'auto' }}>
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: 'var(--text-primary)', opacity: 0.8, whiteSpace: 'pre-wrap' }}>
{`- @tauri-apps/api: Apache-2.0 or MIT
- @tauri-apps/plugin-fs: Apache-2.0 or MIT
- @tauri-apps/plugin-http: Apache-2.0 or MIT
- @tauri-apps/plugin-opener: Apache-2.0 or MIT
- @tauri-apps/plugin-os: Apache-2.0 or MIT
- @tauri-apps/plugin-shell: Apache-2.0 or MIT
- fflate: MIT
- @mui/joy: MIT
- framer-motion: MIT
- lucide-react: ISC`}
                </Typography>
            </Card>
        </Box>
    );
}
