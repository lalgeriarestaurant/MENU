// Fichier : api/update-menu.js
const { Octokit } = require("@octokit/core");

module.exports = async (req, res) => {
    // ========== CONFIGURATION CORS ========== //
    const allowedOrigins = [
        'https://lalgeriarestaurant.github.io',
        'https://lalgeriarestaurant.github.io/MENU/',
        'https://menu-two-ashy.vercel.app'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    // ========== FIN CONFIGURATION CORS ========== //

    // 1. Vérification de la méthode HTTP principale
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Méthode non autorisée',
            message: 'Seules les requêtes POST sont acceptées' 
        });
    }

    // 2. Configuration à partir des variables d'environnement
    // NE JAMAIS METTRE LE TOKEN EN DUR DANS LE CODE !!!
    const {
        GITHUB_TOKEN,
        GITHUB_OWNER = 'lalgeriarestaurant',
        GITHUB_REPO = 'lalgeriarestaurant',
        FILE_PATH = 'update-menu.json'
    } = process.env;

    // 3. Validation des paramètres essentiels
    if (!GITHUB_TOKEN) {
        console.error('ERREUR CRITIQUE: GITHUB_TOKEN manquant');
        return res.status(500).json({
            error: 'Configuration serveur incomplète',
            message: 'Le token GitHub est manquant'
        });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    try {
        // 4. Récupération des données du menu
        const menuData = req.body;
        
        if (!menuData || typeof menuData !== 'object') {
            return res.status(400).json({
                error: 'Données invalides',
                message: 'Le format du menu est incorrect'
            });
        }

        // 5. Récupération du SHA du fichier existant
        let currentSha = null;
        try {
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: FILE_PATH
            });
            
            // Vérifier si la réponse contient le SHA
            if (data && data.sha) {
                currentSha = data.sha;
                console.log(`SHA existant récupéré: ${currentSha}`);
            } else {
                console.log('Fichier trouvé mais SHA manquant');
            }
        } catch (error) {
            if (error.status === 404) {
                console.log('Fichier non trouvé, création d\'un nouveau fichier');
            } else {
                console.error('Erreur lors de la récupération du fichier:', error);
                throw error;
            }
        }

        // 6. Préparation du contenu
        const content = Buffer.from(JSON.stringify(menuData, null, 2)).toString('base64');
        
        // 7. Mise à jour du fichier sur GitHub
        const response = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: FILE_PATH,
            message: `Mise à jour menu - ${new Date().toLocaleString('fr-FR')}`,
            content: content,
            sha: currentSha || undefined  // undefined si nouveau fichier
        });

        console.log('Fichier mis à jour avec succès:', response.data.commit.html_url);
        
        // 8. Réponse de succès
        res.status(200).json({
            success: true,
            message: 'Menu mis à jour avec succès!',
            commitUrl: response.data.commit.html_url
        });

    } catch (error) {
        // 9. Gestion d'erreur détaillée
        console.error('ERREUR GitHub:', error);
        
        let errorMessage = 'Erreur lors de la mise à jour';
        let errorDetails = error.message;
        
        if (error.response && error.response.data) {
            console.error('Détails GitHub:', error.response.data);
            
            // Essayons d'extraire le message d'erreur de GitHub
            if (error.response.data.message) {
                errorMessage += `: ${error.response.data.message}`;
            }
            
            // Informations supplémentaires pour le débogage
            if (error.response.data.errors) {
                errorDetails += ` | Errors: ${JSON.stringify(error.response.data.errors)}`;
            }
        }

        res.status(500).json({
            error: errorMessage,
            details: errorDetails,
            request: {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: FILE_PATH
            },
            // Ajout d'informations supplémentaires pour le débogage
            statusCode: error.status,
            fullError: error.stack
        });
    }
};
