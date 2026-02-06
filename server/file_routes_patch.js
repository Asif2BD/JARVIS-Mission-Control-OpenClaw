// --- FILE DOWNLOADS ---

app.get('/api/files/:path(*)', async (req, res) => {
    try {
        const filePath = req.params.path;
        const fullPath = path.join(MISSION_CONTROL_DIR, filePath);
        
        // Security: Ensure path is within MISSION_CONTROL_DIR
        const resolvedPath = path.resolve(fullPath);
        const resolvedBase = path.resolve(MISSION_CONTROL_DIR);
        
        if (!resolvedPath.startsWith(resolvedBase)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if file exists
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Set content type based on extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        
        // Stream the file
        const fileStream = fsSync.createReadStream(fullPath);
        fileStream.pipe(res);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

