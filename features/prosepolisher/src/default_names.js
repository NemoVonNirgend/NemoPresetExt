export const defaultNames = new Set([
    // --- English/Western (Modern, Classic & Variations) ---
    'aaron', 'adam', 'alan', 'albert', 'alec', 'alex', 'alexander', 'alfred', 'andrew', 'andy',
    'anthony', 'arthur', 'asher', 'ashley', 'aiden', 'austin', 'barry', 'ben', 'benjamin', 'bill',
    'billy', 'bob', 'bobby', 'brad', 'bradley', 'brandon', 'brayden', 'brian', 'bruce', 'bryan',
    'caleb', 'calvin', 'cameron', 'carl', 'carter', 'charles', 'charlie', 'chris', 'christian',
    'christopher', 'cody', 'colin', 'connor', 'craig', 'curtis', 'dale', 'damon', 'daniel', 'darren',
    'dave', 'david', 'dean', 'dennis', 'derek', 'devin', 'douglas', 'dylan', 'eddie', 'edgar',
    'edward', 'eli', 'elijah', 'elliot', 'eric', 'ethan', 'evan', 'felix', 'finn', 'frank', 'fred',
    'gabriel', 'gary', 'gavin', 'george', 'gordon', 'graham', 'grant', 'greg', 'gregory', 'grayson',
    'harold', 'harry', 'hayden', 'henry', 'howard', 'hudson', 'hunter', 'ian', 'isaac', 'isaiah',
    'jack', 'jackson', 'jacob', 'jaden', 'jake', 'james', 'jason', 'jayden', 'jeff', 'jeffrey',
    'jeremy', 'jerry', 'jesse', 'jim', 'jimmy', 'joe', 'joel', 'john', 'johnny', 'jonathan',
    'jordan', 'joseph', 'josh', 'joshua', 'josiah', 'juan', 'julian', 'justin', 'keith', 'kenneth',
    'kevin', 'kyle', 'lance', 'larry', 'lawrence', 'leo', 'leonard', 'levi', 'lewis', 'liam',
    'lincoln', 'logan', 'louis', 'lucas', 'luke', 'malcolm', 'marcus', 'mark', 'martin', 'mason',
    'matt', 'matthew', 'maverick', 'max', 'maxwell', 'michael', 'mike', 'miles', 'mitchell', 'morgan',
    'nathan', 'nathaniel', 'neil', 'nicholas', 'nick', 'noah', 'nolan', 'oliver', 'oscar', 'owen',
    'patrick', 'paul', 'peter', 'philip', 'preston', 'ralph', 'randy', 'ray', 'raymond', 'reid',
    'richard', 'rick', 'riley', 'robert', 'roger', 'ronald', 'ross', 'roy', 'russell', 'ryan',
    'sam', 'samuel', 'scott', 'sean', 'sebastian', 'seth', 'shane', 'shaun', 'shawn', 'spencer',
    'stanley', 'stephen', 'steve', 'steven', 'stuart', 'terry', 'theodore', 'thomas', 'tim',
    'timothy', 'todd', 'tony', 'travis', 'trevor', 'tyler', 'victor', 'vincent', 'warren', 'wayne',
    'wesley', 'will', 'william', 'wyatt', 'zachary', 'zane',
    'abigail', 'addison', 'alexa', 'alexandra', 'alexis', 'alice', 'alicia', 'allison', 'alyssa',
    'amanda', 'amber', 'amelia', 'amy', 'ana', 'anastasia', 'andrea', 'angela', 'angelina', 'anita',
    'ann', 'anna', 'anne', 'annette', 'annie', 'april', 'aria', 'ariana', 'ariel', 'ashlee',
    'ashlyn', 'audrey', 'aurora', 'ava', 'avery', 'bailey', 'barbara', 'beatrice', 'becky', 'bella',
    'beth', 'beverly', 'bonnie', 'brandy', 'brianna', 'bridget', 'brittany', 'brooke', 'brooklyn',
    'caitlin', 'camila', 'candice', 'carla', 'carly', 'carmen', 'carol', 'caroline', 'carolyn',
    'carrie', 'casey', 'cassandra', 'catherine', 'cathy', 'charlotte', 'chelsea', 'cheryl',
    'chloe', 'christina', 'christine', 'christy', 'cindy', 'claire', 'clara', 'colleen', 'connie',
    'courtney', 'crystal', 'cynthia', 'daisy', 'dana', 'danielle', 'dawn', 'debbie', 'deborah',
    'debra', 'diana', 'diane', 'donna', 'doris', 'dorothy', 'eleanor', 'elena', 'elizabeth',
    'ella', 'ellie', 'emilia', 'emily', 'emma', 'erica', 'erin', 'esther', 'eva', 'evelyn',
    'everly', 'faith', 'fiona', 'gabriella', 'gayle', 'gemma', 'genesis', 'gianna', 'gina',
    'ginger', 'gladys', 'gloria', 'grace', 'hailey', 'hannah', 'harper', 'hazel', 'heather',
    'heidi', 'helen', 'holly', 'hope', 'irene', 'iris', 'isabella', 'isla', 'jackie', 'jacqueline',
    'jade', 'jamie', 'jane', 'janet', 'janice', 'jasmine', 'jean', 'jenna', 'jennifer', 'jenny',
    'jessica', 'jill', 'joan', 'joann', 'joanna', 'joanne', 'jocelyn', 'jodi', 'joy', 'joyce',
    'judith', 'judy', 'julia', 'julie', 'june', 'karen', 'kate', 'katelyn', 'katherine', 'kathleen',
    'kathryn', 'kathy', 'katie', 'kayla', 'kelly', 'kelsey', 'kendall', 'kenzie', 'kim', 'kimberly',
    'kristen', 'kristin', 'kristina', 'krystal', 'kylie', 'lacey', 'laura', 'lauren', 'layla',
    'leah', 'leanne', 'leila', 'lena', 'leslie', 'lillian', 'lily', 'linda', 'lindsay', 'lisa',
    'lori', 'lorraine', 'louise', 'lucy', 'luna', 'lydia', 'lynn', 'mackenzie', 'madeline', 'madison',
    'makayla', 'mandy', 'marcia', 'margaret', 'maria', 'mariah', 'marie', 'marilyn', 'marina',
    'marjorie', 'martha', 'mary', 'mave', 'maya', 'megan', 'melanie', 'melinda', 'melissa', 'melody',
    'mia', 'michelle', 'mila', 'mildred', 'mindy', 'miranda', 'molly', 'monica', 'morgan', 'nadia',
    'nancy', 'naomi', 'natalie', 'nicole', 'nina', 'nora', 'norma', 'olivia', 'paige', 'pamela',
    'paula', 'payton', 'peggy', 'penelope', 'penny', 'phyllis', 'piper', 'quinn', 'rachel', 'reagan',
    'rebecca', 'regina', 'renee', 'rhonda', 'riley', 'rita', 'roberta', 'robin', 'rosa', 'rose',
    'rosemary', 'ruby', 'ruth', 'sabrina', 'sadie', 'sally', 'samantha', 'sandra', 'sara', 'sarah',
    'savannah', 'scarlett', 'selena', 'shannon', 'sharon', 'sheila', 'shelby', 'shelley', 'sherry',
    'shirley', 'skylar', 'sofia', 'sophia', 'sophie', 'stacey', 'stacy', 'stella', 'stephanie',
    'sue', 'susan', 'suzanne', 'sydney', 'sylvia', 'tamara', 'tammy', 'tara', 'taylor', 'teresa',
    'tiffany', 'tina', 'tracy', 'valerie', 'vanessa', 'veronica', 'victoria', 'violet', 'virginia',

    // --- Hispanic / Latino ---
    'agustín', 'alberto', 'alejandro', 'alonso', 'álvaro', 'andrés', 'ángel', 'antonio', 'armando',
    'arturo', 'benito', 'camilo', 'carlos', 'cesar', 'claudio', 'cristian', 'damián', 'david',
    'diego', 'eduardo', 'emiliano', 'emilio', 'enrique', 'ernesto', 'esteban', 'federico', 'felipe',
    'fernando', 'francisco', 'gabriel', 'gerardo', 'gonzalo', 'guillermo', 'gustavo', 'héctor',
    'hernán', 'hugo', 'ignacio', 'isidro', 'jaime', 'javier', 'jesús', 'joaquín', 'jorge', 'josé',
    'juan', 'julio', 'leonardo', 'leopoldo', 'lorenzo', 'lucas', 'luciano', 'luis', 'manuel',
    'marcelo', 'marcos', 'mariano', 'mario', 'martín', 'mateo', 'mauricio', 'miguel', 'nicolás',
    'octavio', 'oscar', 'pablo', 'pedro', 'rafael', 'ramiro', 'ramón', 'raúl', 'ricardo', 'roberto',
    'rodolfo', 'rodrigo', 'ruben', 'salvador', 'santiago', 'sebastián', 'sergio', 'tomás', 'vicente',
    'victor', 'adriana', 'agustina', 'alejandra', 'alicia', 'alma', 'amalia', 'ana', 'andrea',
    'ángela', 'antonella', 'antonia', 'ariadna', 'bárbara', 'beatriz', 'belén', 'blanca', 'camila',
    'carla', 'carlota', 'carmen', 'carolina', 'catalina', 'cecilia', 'celeste', 'clara', 'claudia',
    'constanza', 'daniela', 'delfina', 'dolores', 'elena', 'elisa', 'eloísa', 'emilia', 'esmeralda',
    'esperanza', 'estela', 'eugenia', 'eva', 'fabiola', 'fatima', 'florencia', 'gabriela', 'gloria',
    'graciela', 'guadalupe', 'inés', 'irene', 'isabel', 'isabella', 'isidora', 'jimena', 'josefina',
    'juana', 'julia', 'juliana', 'julieta', 'laura', 'leticia', 'liliana', 'lola', 'lorena', 'lourdes',
    'lucía', 'luciana', 'luisa', 'luz', 'magdalena', 'maite', 'marcela', 'margarita', 'maría',
    'mariana', 'marina', 'marisol', 'marta', 'martina', 'mercedes', 'micaela', 'miguela', 'miriam',
    'mónica', 'natalia', 'norma', 'olivia', 'paloma', 'paola', 'patricia', 'paula', 'pilar', 'ramona',
    'raquel', 'regina', 'renata', 'rocío', 'rosa', 'rosario', 'sandra', 'sara', 'silvia', 'sofía',
    'soledad', 'sonia', 'susana', 'teresa', 'valentina', 'valeria', 'verónica', 'victoria', 'viola',
    'violeta', 'virginia', 'ximena', 'yadira', 'yamila', 'yesenia', 'yolanda', 'zoraida',

    // --- European (French, German, Italian, Scandinavian, Slavic, Greek) ---
    'adrien', 'alain', 'antoine', 'armand', 'auguste', 'aurélien', 'benoît', 'bruno', 'christian',
    'christophe', 'claude', 'clément', 'cyril', 'damien', 'denis', 'didier', 'édouard', 'émile',
    'emmanuel', 'étienne', 'eugène', 'fabien', 'florent', 'frédéric', 'gaël', 'gaspard', 'gaston',
    'gérard', 'gilbert', 'gilles', 'grégoire', 'guillaume', 'guy', 'hervé', 'honoré', 'jacques',
    'jean', 'jérôme', 'joël', 'jonathan', 'josé', 'jules', 'julien', 'laurent', 'lionel', 'loïc',
    'luc', 'marc', 'marcel', 'mathieu', 'maurice', 'michel', 'nicolas', 'noël', 'olivier', 'pascal',
    'philippe', 'pierre', 'raymond', 'régis', 'rémi', 'rené', 'romain', 'sébastien', 'serge',
    'stéphane', 'théo', 'théophile', 'thibault', 'thierry', 'tristan', 'valentin', 'vincent', 'xavier',
    'yann', 'yves', 'yvon', // French Male
    'adélaïde', 'adèle', 'adrienne', 'agathe', 'agnès', 'aimée', 'alexandrine', 'aline', 'amandine',
    'anaïs', 'arielle', 'astrid', 'audrey', 'aurélie', 'aurore', 'béatrice', 'bénédicte', 'berthe',
    'brigitte', 'capucine', 'carine', 'cécile', 'céline', 'chantal', 'charlène', 'christelle',
    'claire', 'clotilde', 'colette', 'corinne', 'delphine', 'denise', 'diane', 'dominique', 'édith',
    'élise', 'élodie', 'fabienne', 'fanny', 'flavie', 'florence', 'frédérique', 'geneviève', 'gisèle',
    'hélène', 'hortense', 'ines', 'irène', 'isabelle', 'joséphine', 'josette', 'laetitia', 'léa',
    'léonie', 'liliane', 'lucie', 'madeleine', 'magali', 'manon', 'margaux', 'margot', 'marine',
    'mathilde', 'maud', 'mélanie', 'mélissa', 'micheline', 'monique', 'muriel', 'mylène', 'nadège',
    'nathalie', 'nicole', 'ninon', 'océane', 'odette', 'pascale', 'paulette', 'pauline', 'pénélope',
    'perrine', 'raphaëlle', 'régine', 'reine', 'rolande', 'romane', 'rosalie', 'sabine', 'sandrine',
    'séverine', 'solange', 'solène', 'sophie', 'sylviane', 'sylvie', 'valérie', 'véronique', 'virginie', // French Female
    'andreas', 'bernd', 'claus', 'dieter', 'dirk', 'erwin', 'frank', 'friedrich', 'gerhard', 'günter',
    'hans', 'heinz', 'helmut', 'hermann', 'horst', 'jan', 'jens', 'joachim', 'jörg', 'jürgen', 'kai',
    'karl', 'klaus', 'kurt', 'manfred', 'markus', 'martin', 'mathias', 'michael', 'olaf', 'peter',
    'rainer', 'ralf', 'roland', 'rüdiger', 'stefan', 'thomas', 'torsten', 'udo', 'ulrich', 'uwe',
    'walter', 'werner', 'wolfgang', // German Male
    'angelika', 'anja', 'barbara', 'birgit', 'brigitte', 'claudia', 'cornelia', 'doris', 'elke',
    'erika', 'eva', 'gabriele', 'gerda', 'gisela', 'gudrun', 'hannelore', 'heike', 'helga', 'hildegard',
    'ingrid', 'karin', 'kerstin', 'marion', 'martina', 'monika', 'petra', 'renate', 'sabine', 'silke',
    'simone', 'susanne', 'ulrike', 'ursula', 'ute', // German Female
    'alessio', 'alfredo', 'angelo', 'carlo', 'daniele', 'davide', 'dino', 'domenico', 'edoardo',
    'emanuele', 'enzo', 'fabio', 'filippo', 'flavio', 'gabriele', 'gianni', 'giorgio', 'giovanni',
    'giulio', 'jacopo', 'luca', 'luigi', 'manuel', 'massimo', 'maurizio', 'michele', 'nicola',
    'paolo', 'pier', 'piero', 'riccardo', 'roberto', 'salvatore', 'samuele', 'sandro', 'simone',
    'stefano', 'tommaso', 'umberto', 'vincenzo', // Italian Male
    'alessia', 'alessandra', 'angela', 'anna', 'arianna', 'caterina', 'cecilia', 'cinzia', 'cristina',
    'daniela', 'deborah', 'eleonora', 'elisa', 'elisabetta', 'emanuela', 'federica', 'gabriella',
    'giorgia', 'giovanna', 'ilaria', 'laura', 'loredana', 'loretta', 'lucrezia', 'margherita',
    'marta', 'martina', 'michela', 'nadia', 'nicoletta', 'paola', 'patrizia', 'raffaella', 'rita',
    'roberta', 'rosa', 'rossella', 'sabrina', 'sara', 'serena', 'silvia', 'simona', 'sonia', 'stefania',
    'teresa', 'tiziana', 'valentina', 'valeria', 'vanessa', 'veronica', // Italian Female
    'anders', 'bjorn', 'erik', 'hans', 'jan', 'jens', 'karl', 'lars', 'magnus', 'mikael', 'nils',
    'ola', 'per', 'sven', 'tomas', // Scandinavian Male
    'anita', 'anna', 'birgitta', 'bodil', 'elin', 'eva', 'gerd', 'gun', 'helena', 'inger', 'karin',
    'kerstin', 'kristina', 'lena', 'linda', 'lisbeth', 'marie', 'mona', 'nina', 'siv', 'ulla', // Scandinavian Female
    'adam', 'arkadiusz', 'artur', 'bartosz', 'czesław', 'dariusz', 'grzegorz', 'kamil', 'krzysztof',
    'leszek', 'marcin', 'marek', 'mariusz', 'mirosław', 'przemysław', 'radosław', 'sławomir',
    'tadeusz', 'tomasz', 'waldemar', 'wiesław', 'zbigniew', 'zygmunt', // Polish Male
    'agnieszka', 'beata', 'bożena', 'danuta', 'dorota', 'edyta', 'elżbieta', 'evelina', 'ewa',
    'grażyna', 'halina', 'hanna', 'helena', 'irena', 'iwona', 'izabela', 'jadwiga', 'joanna',
    'jolanta', 'justyna', 'katarzyna', 'kinga', 'magdalena', 'małgorzata', 'marta', 'monika',
    'patrycja', 'renata', 'sylwia', 'teresa', 'urszula', 'wioletta', 'yolanta', 'zenobia', // Polish Female
    'aleksei', 'boris', 'daniil', 'egor', 'fedor', 'gennady', 'gleb', 'igor', 'ilya', 'kirill', 'leonid',
    'maksim', 'matvei', 'nikita', 'oleg', 'roman', 'ruslan', 'stanislav', 'timofei', 'vadim', 'vasily',
    'viktor', 'vitaly', 'vyacheslav', 'yaroslav', 'yegor', // Russian Male
    'alina', 'alla', 'alyona', 'angelina', 'daria', 'dina', 'galina', 'inessa', 'inga', 'karina', 'kira',
    'ksenia', 'lada', 'larisa', 'lidiya', 'lyubov', 'lyudmila', 'margarita', 'marina', 'mila', 'milena',
    'nelya', 'oksana', 'olesya', 'polina', 'raisa', 'regina', 'sofiya', 'tamara', 'valeria', 'vasilisa',
    'vera', 'veronika', 'viktoriya', 'yulia', 'zoya', // Russian Female
    'alexios', 'apostolos', 'dimitris', 'georgios', 'ilias', 'nikolaos', 'panagiotis', 'spyridon',
    'theodoros', 'vasilis', 'yiannis', // Greek Male
    'afroditi', 'anastasia', 'daphne', 'eleni', 'katerina', 'maria', 'sofia', 'vasiliki', // Greek Female

    // --- East Asian (Japanese, Chinese, Korean) ---
    'akio', 'atsushi', 'daisuke', 'eiji', 'fumio', 'hideki', 'hideo', 'hikaru', 'hiroki', 'hisashi',
    'ichiro', 'isamu', 'jiro', 'jun', 'katsuo', 'kazuya', 'kei', 'kenichi', 'koji', 'mamoru',
    'masaru', 'minoru', 'naoki', 'osamu', 'ryota', 'satoshi', 'shinji', 'sho', 'shota', 'susumu',
    'takahiro', 'takumi', 'tatsuya', 'tetsuo', 'tomoya', 'tsuyoshi', 'yasuhiro', 'yoichi', 'yosuke',
    'yutaka', 'zen', // Japanese Male
    'ai', 'aimi', 'aina', 'akemi', 'akiko', 'ami', 'asuka', 'atsuko', 'aya', 'ayano', 'chika', 'chiyo',
    'chiyoko', 'eiko', 'emi', 'emiko', 'etsuko', 'fumiko', 'haruka', 'haruna', 'hideko', 'hitomi',
    'honoka', 'izumi', 'junko', 'kaori', 'kasumi', 'kazue', 'keiko', 'kiyo', 'kiyoko', 'kumiko',
    'kyoko', 'mai', 'maki', 'mariko', 'masami', 'mayu', 'megumi', 'midori', 'mika', 'miki', 'misaki',
    'mitsuko', 'miyako', 'miyuki', 'mizuki', 'moe', 'momoko', 'nana', 'nanami', 'naoko', 'naomi',
    'natsuki', 'natsumi', 'noriko', 'reina', 'rie', 'rika', 'riko', 'rin', 'ryoko', 'sachiko', 'sadako',
    'satoko', 'satomi', 'sayuri', 'setsuko', 'shizuka', 'sumiko', 'suzuko', 'takako', 'tomoko', 'tomomi',
    'yoko', 'yoshie', 'yoshiko', 'yumiko', 'yuriko', // Japanese Female
    'an', 'bao', 'chao', 'de', 'dong', 'feng', 'gang', 'guo', 'hai', 'hao', 'hong', 'hui', 'jian',
    'jiang', 'jun', 'kang', 'lei', 'liang', 'lin', 'long', 'peng', 'qiang', 'shan', 'tao', 'tian',
    'tong', 'xin', 'xue', 'yan', 'yang', 'yao', 'yi', 'yong', 'yu', 'yuan', 'zemin', 'zheng', 'zhi',
    'zhong', 'zhou', // Chinese Male (Pinyin)
    'chun', 'cui', 'dan', 'e', 'fang', 'fen', 'guang', 'he', 'heng', 'huan', 'ji', 'jia', 'juan',
    'kun', 'lan', 'li', 'lian', 'ling', 'lin', 'mei', 'min', 'na', 'ning', 'qian', 'qing', 'qiu',
    'shu', 'ting', 'wei', 'wen', 'xiu', 'ya', 'yan', 'ying', 'yun', 'zhen', 'zhi', // Chinese Female (Pinyin)
    'chang-min', 'dong-hyun', 'eun-woo', 'geon-woo', 'ha-ram', 'hyun-woo', 'jae-won', 'jeong-hun',
    'ji-ho', 'ji-hu', 'ji-hun', 'jin-woo', 'joon-ho', 'ju-won', 'jung-ho', 'kang-min', 'ki-tae',
    'min-gyu', 'min-hyuk', 'min-jae', 'min-jun', 'min-kyu', 'min-seok', 'sang-hun', 'seo-jun',
    'seong-jin', 'seong-min', 'seung-hyun', 'si-u', 'sung-hyun', 'sung-jin', 'sung-min', 'tae-hyung',
    'woo-jin', 'ye-jun', 'yeong-cheol', 'yeong-gi', 'yeong-ho', 'yeong-su', 'yong-jun', 'yoon-jae', // Korean Male
    'arin', 'bo-ram', 'chae-won', 'da-eun', 'eun-ji', 'eun-ju', 'eun-kyung', 'ga-eun', 'ha-eun',
    'ha-yun', 'hye-jin', 'hyeon-ju', 'hyun-joo', 'ji-eun', 'ji-hye', 'ji-min', 'ji-u', 'ji-won',
    'ji-yeon', 'ji-yeong', 'ji-yun', 'jin-a', 'ju-hee', 'kyung-hee', 'mi-yeon', 'min-ji', 'min-seo',
    'na-yeon', 'seo-hyeon', 'seo-yun', 'seul-gi', 'seung-hee', 'si-eun', 'soo-jin', 'su-bin',
    'su-jin', 'su-min', 'sun-young', 'yeeun', 'ye-jin', 'ye-won', 'yoo-jin', 'yoon-ah', 'yoon-seo',
    'young-mi', 'yu-jin', 'yu-na', // Korean Female

    // --- South & Central Asian ---
    'aamir', 'abbas', 'abdul', 'adnan', 'ahsan', 'akshay', 'amir', 'anand', 'anil', 'ankur', 'arun',
    'ashok', 'deepak', 'dev', 'farhan', 'ganesh', 'harish', 'imran', 'karan', 'karthik', 'manish',
    'manoj', 'naveen', 'prakash', 'pranav', 'raj', 'rajan', 'rajesh', 'rakesh', 'ramesh', 'ravi',
    'rishabh', 'rishi', 'sachin', 'sameer', 'sandeep', 'sanjay', 'sanjeev', 'shahrukh', 'shankar',
    'sunil', 'suresh', 'tarun', 'venkat', 'vijay', 'vikas', 'vinay', 'vinod', 'vishal', 'vivek', // Indian/Pakistani Male
    'aarti', 'aishwarya', 'alia', 'amrita', 'anjana', 'anju', 'ankita', 'asha', 'bhavna', 'bhumi',
    'deepa', 'deepika', 'divya', 'gauri', 'gayatri', 'geeta', 'hema', 'jaya', 'jyoti', 'kajol',
    'kalpana', 'kavita', 'lakshmi', 'lalita', 'lata', 'madhavi', 'madhu', 'madhuri', 'mala', 'manju',
    'meena', 'meera', 'mona', 'nalini', 'neelam', 'neetu', 'nisha', 'parvati', 'pooja', 'poonam',
    'pratibha', 'preeti', 'priyanka', 'radha', 'rani', 'rashmi', 'rekha', 'renu', 'reshma', 'ritu',
    'sangeeta', 'sarika', 'savita', 'seema', 'shaila', 'shalini', 'shanti', 'sharma', 'shilpa',
    'shobha', 'sita', 'smita', 'sneha', 'sonali', 'sonam', 'sonia', 'sudha', 'sujata', 'suman',
    'sunidhi', 'sushma', 'uma', 'usha', 'vidya', 'vijaya', 'yamuna', // Indian/Pakistani Female

    // --- African (Various Regions) ---
    'abebe', 'abimbola', 'abolaji', 'abubakar', 'adamu', 'ade', 'ayodele', 'babajide', 'chidi',
    'chidozie', 'chijioke', 'chike', 'chukwu', 'daren', 'dumisani', 'ebuka', 'efe', 'femi', 'folarin',
    'jaja', 'jide', 'kamau', 'katlego', 'kayode', 'kelechi', 'kofi', 'kunle', 'kwasi', 'lerato',
    'mandla', 'masai', 'musa', 'nnamdi', 'obi', 'obinna', 'okechukwu', 'olumide', 'olusegun',
    'simba', 'sipho', 'tafari', 'tau', 'themba', 'tunde', 'uzoma', 'yared', 'zane', 'zulu', // African Male
    'abeo', 'abena', 'ada', 'akua', 'amara', 'amina', 'anika', 'asha', 'ayana', 'aziza', 'binta',
    'bosede', 'chioma', 'efia', 'efua', 'eshe', 'folake', 'halima', 'hasana', 'ifunanya', 'jaha',
    'jamila', 'kamilah', 'kenya', 'kiara', 'latifa', 'makena', 'mariama', 'monifa', 'nakia', 'nia',
    'nkechi', 'oluchi', 'panya', 'ramla', 'sadia', 'safiya', 'shani', 'taraji', 'temitope', 'uche',
    'wanjiru', 'xola', 'zainabu', 'zalika', 'zola', 'zuri', // African Female

    // --- Arabic / Middle Eastern / Turkish ---
    'abdel', 'abdullah', 'adnan', 'ahmad', 'ali', 'amir', 'ayman', 'bashir', 'bilal', 'fadi', 'fahd',
    'faris', 'faisal', 'ghassan', 'habib', 'hadi', 'hakim', 'hamid', 'hani', 'hasan', 'hisham',
    'hussein', 'ibrahim', 'imad', 'ismail', 'jamal', 'khalid', 'khalil', 'maher', 'mahmoud', 'majid',
    'malik', 'marwan', 'mohamad', 'mustafa', 'nabil', 'nadir', 'naji', 'nasir', 'omar', 'osama',
    'rachid', 'rashid', 'riad', 'saeed', 'salah', 'salem', 'sami', 'samir', 'sultan', 'tarek', 'walid',
    'yasin', 'yasser', 'youssef', 'younes', 'zakaria', // Arabic Male
    'aaliyah', 'amal', 'amina', 'amira', 'asma', 'aya', 'basma', 'bushra', 'dalia', 'dina', 'dunya',
    'fadila', 'farah', 'fariha', 'fatima', 'fayruz', 'habiba', 'hafsa', 'haifa', 'hala', 'halima',
    'hana', 'hanan', 'hiba', 'hind', 'houda', 'iman', 'jamila', 'karima', 'khadija', 'lamia', 'latifa',
    'layla', 'leila', 'lina', 'lubna', 'maha', 'maisa', 'malak', 'manal', 'mariam', 'maryam', 'mona',
    'mounia', 'nada', 'nadia', 'nadira', 'nahla', 'naima', 'najwa', 'nawal', 'nawal', 'nour', 'noura',
    'rabia', 'randa', 'rania', 'rashida', 'reem', 'rima', 'sabah', 'safa', 'safiya', 'sahar', 'salma',
    'salwa', 'samar', 'samia', 'sana', 'shadia', 'shahira', 'shakira', 'sharifa', 'soraya', 'suha',
    'sumaya', 'taghrid', 'yasmin', 'yasmine', 'zahra', 'zaynab', 'zubaida', // Arabic Female
    'ahmet', 'ali', 'aydin', 'baran', 'berk', 'can', 'cem', 'deniz', 'emre', 'eren', 'kaan', 'mehmet',
    'murat', 'mustafa', 'onur', 'ozan', 'serkan', 'tarkan', 'umut', 'yusuf', // Turkish Male
    'aylin', 'aysel', 'ayse', 'banu', 'cemre', 'deniz', 'elif', 'emine', 'esra', 'fatma', 'gamze',
    'gizrm', 'hande', 'hulya', 'ipek', 'leyla', 'merve', 'nil', 'pinar', 'selin', 'sevda', 'yasemin', // Turkish Female

    // --- Celtic (Irish, Scottish, Welsh) ---
    'aidan', 'angus', 'barry', 'brendan', 'brennan', 'caden', 'callum', 'cian', 'ciaran', 'colm',
    'conall', 'conan', 'connell', 'conor', 'corey', 'cormac', 'darcy', 'darragh', 'declan', 'dermot',
    'desmond', 'devlin', 'donovan', 'douglas', 'duncan', 'eamon', 'eoghan', 'eoin', 'ewan', 'fearghal',
    'fergus', 'finian', 'finn', 'finnegan', 'fionn', 'fraser', 'gallagher', 'garrett', 'gavin',
    'glenn', 'gordon', 'graeme', 'hamish', 'iain', 'keegan', 'kevin', 'kian', 'kieran', 'killian',
    'lachlan', 'liam', 'lorcan', 'malachy', 'niall', 'oísin', 'owen', 'padraig', 'patrick', 'quinn',
    'riordan', 'roan', 'ronan', 'rory', 'rowan', 'ryan', 'seamus', 'sean', 'shane', 'shay', 'tadhg',
    'tiernan', 'torin', 'turlough', // Celtic Male
    'aisling', 'aithne', 'alannah', 'aoibheann', 'aoife', 'blaithin', 'brenda', 'brianna', 'bridget',
    'bronagh', 'caitlin', 'caitriona', 'cara', 'casey', 'ciara', 'cliona', 'clodagh', 'deirdre',
    'eabha', 'eavan', 'eileen', 'eilidh', 'eimear', 'eithne', 'emer', 'enna', 'erin', 'etain', 'fionnuala',
    'grainne', 'iona', 'isobel', 'keira', 'kelly', 'kerry', 'laoise', 'maeve', 'mairead', 'mairi',
    'maureen', 'moira', 'mona', 'morag', 'muireann', 'murphy', 'niamh', 'nora', 'nuala', 'ona',
    'orla', 'orlaith', 'regan', 'riley', 'roisin', 'saoirse', 'shannon', 'sheila', 'shona', 'siobhan',
    'sorcha', 'una', // Celtic Female
    'alun', 'aneurin', 'bedwyr', 'bryn', 'caradoc', 'dai', 'dewi', 'dylan', 'emlyn', 'evan', 'gareth',
    'geraint', 'gethin', 'gruffudd', 'gwilym', 'hywel', 'idris', 'iolo', 'leuan', 'lloyd', 'luned',
    'macsen', 'madoc', 'meredith', 'owain', 'rhodri', 'rhys', 'sion', 'talfryn', 'taliesin', 'tomos', // Welsh Male
    'angharad', 'arianwen', 'bethan', 'blodwen', 'bronwen', 'carys', 'catrin', 'ceri', 'cerys',
    'dilys', 'eira', 'eleri', 'elin', 'ffion', 'gwen', 'gwendolen', 'gwenllian', 'haf', 'heledd',
    'lowri', 'lynneth', 'mali', 'manon', 'megan', 'nia', 'olwen', 'rhian', 'rhiannon', 'sian', 'seren', // Welsh Female

    // --- Biblical / Hebrew ---
    'abel', 'abraham', 'adam', 'amos', 'ari', 'asher', 'barak', 'caleb', 'eitan', 'elazar', 'eli',
    'gideon', 'ilan', 'ira', 'levi', 'malachi', 'mordecai', 'moshe', 'noam', 'omer', 'raphael', 'saul',
    'seth', 'shai', 'simon', 'solomon', 'uri', 'yaakov', 'yair', 'yehuda', 'yitzhak', 'zev', // Hebrew Male
    'abigail', 'adina', 'aliza', 'aviva', 'chana', 'dalia', 'dafna', 'devorah', 'eden', 'eliana',
    'elisheva', 'esther', 'faiga', 'galia', 'hadassah', 'ilana', 'irit', 'keziah', 'leora', 'liba',
    'lila', 'malka', 'margalit', 'meira', 'michal', 'miriam', 'naomi', 'nava', 'orli', 'penina',
    'rachel', 'raizel', 'rebecca', 'rina', 'rivka', 'shira', 'shoshana', 'talia', 'tamar', 'tzivia',
    'yael', 'yakira', 'zissel', // Hebrew Female

    // --- Fantasy & Sci-Fi (Common in RPG/Writing Context) ---
    'aragorn', 'legolas', 'gandalf', 'frodo', 'gimli', 'boromir', 'sauron', 'elrond', 'bilbo',
    'daenerys', 'tyrion', 'arya', 'jon', 'sansa', 'cersei', 'jaime', 'bran', 'khaleesi', 'jorah',
    'luke', 'leia', 'han', 'anakin', 'vader', 'obi-wan', 'yoda', 'kylo', 'rey', 'padme', 'chewbacca',
    'harry', 'hermione', 'ron', 'albus', 'severus', 'dumbledore', 'snape', 'voldemort', 'draco',
    'geralt', 'ciri', 'yennefer', 'triss', 'dandelion', 'jaskier', 'vesemir',
    'link', 'zelda', 'ganon', 'mario', 'luigi', 'peach', 'bowser',
    'cloud', 'sephiroth', 'aerith', 'tifa', 'barret', 'zack',
    'kratos', 'atreus', 'freya', 'odin',
    'ezio', 'altair', 'connor', 'kassandra', 'aloy',
    'shepard', 'garrus', 'liara', 'tali', 'wrex', 'mordin',
    'arthas', 'illidan', 'sylvanas', 'jaina', 'thrall',
    'galadriel', 'arwen', 'tauriel', 'eowyn',
    'spock', 'kirk', 'picard', 'riker', 'data', 'worf',

    // --- Unisex & Androgynous ---
    'alex', 'avery', 'bailey', 'blake', 'cameron', 'casey', 'charlie', 'dakota', 'devin', 'drew',
    'elliot', 'emerson', 'finley', 'harley', 'hayden', 'jamie', 'jesse', 'jordan', 'kai', 'kendall',
    'morgan', 'parker', 'peyton', 'quinn', 'reagan', 'reese', 'riley', 'river', 'rowan', 'rory',
    'ryan', 'sage', 'sawyer', 'skyler', 'spencer', 'taylor', 'terry'
]);