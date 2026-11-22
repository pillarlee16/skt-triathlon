import {DatabaseSync} from 'node:sqlite'
import {initial,type Mode,type State} from '../src/model.ts'

export type StoredFile={id:string;bytes:ArrayBuffer;mime:string}

export function openStore(database:string,mode:Mode){
  const db=new DatabaseSync(database)
  db.exec(`
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS event_state (
      id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL, data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS event_file (
      id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL
    );
  `)
  db.prepare('INSERT OR IGNORE INTO event_state VALUES (1,0,?)').run(JSON.stringify(initial(mode)))
  const state=db.prepare('SELECT data FROM event_state WHERE id=1')
  const update=db.prepare('UPDATE event_state SET revision=?,data=? WHERE id=1 AND revision=?')
  const addFile=db.prepare('INSERT INTO event_file VALUES (?,?,?)')
  const file=db.prepare('SELECT mime,data FROM event_file WHERE id=?')
  return {
    read:()=>JSON.parse(state.get()!.data as string) as State,
    file:(id:string)=>file.get(id) as {mime:string;data:Uint8Array}|undefined,
    write(next:State,upload?:StoredFile){
      db.exec('BEGIN IMMEDIATE')
      try{
        const result=update.run(next.revision,JSON.stringify(next),next.revision-1)
        if(result.changes&&upload)addFile.run(upload.id,upload.mime,Buffer.from(upload.bytes))
        db.exec('COMMIT')
        return !!result.changes
      }catch(error){
        db.exec('ROLLBACK')
        throw error
      }
    },
    close:()=>db.close(),
  }
}
